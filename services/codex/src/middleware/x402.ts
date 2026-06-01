import type { MiddlewareHandler } from 'hono';
import { safeErrorDetail } from '../lib/error-safe';

/**
 * x402 payment verification.
 *
 * Year-1 design (audit I-1..I-4 hardened): every payment goes through the
 * on-chain verifier even if Coinbase's facilitator returns valid. The
 * facilitator is a fast-path hint, not an authoritative source, Codex's
 * security boundary is the chain, not a third party.
 *
 * Verification steps:
 *   1. Decode the X-PAYMENT header.
 *   2. Reject if older than 5 minutes (was 24h, far too permissive).
 *   3. Reject if tx_hash was previously consumed (D1 `payments` table -
 *      tx_hash is UNIQUE so concurrent retries from different isolates
 *      can't double-spend).
 *   4. Fetch tx receipt + current block; require ≥ CONFIRMATIONS depth.
 *   5. Decode the USDC `Transfer(from,to,amount)` log from receipt.logs -
 *      NOT `tx.value`, which is native ETH and irrelevant for ERC-20.
 *   6. Assert log.address == USDC, log.topics[2] == payTo, log.data ≥ amount.
 *   7. If all pass, record the tx_hash in D1 (atomic via UNIQUE).
 *
 * x402 spec lives at resources/x402/. The header format is:
 *   X-PAYMENT: <base64-encoded payment payload>
 */
const PAYMENT_TTL_SECONDS = 5 * 60;          // I-6: tighten replay window 24h → 5 min
const CONFIRMATIONS = 12;                    // I-1: confirm depth on Arb Sepolia
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // keccak256("Transfer(address,address,uint256)")

interface X402Env {
  DB: D1Database;
  ARBITRUM_SEPOLIA_RPC: string;
  CODEX_PAY_TO_ADDRESS?: string;
  CODEX_MIN_PAYMENT_USDC_WEI?: string;
  CODEX_USDC_ADDRESS?: string;
  COINBASE_X402_API_KEY?: string;
  ENV?: string;
}

export const x402PaymentMiddleware: MiddlewareHandler<{ Bindings: X402Env }> = async (c, next) => {
  const header = c.req.header('X-PAYMENT');
  if (!header) {
    return c.json(
      {
        error: 'payment_required',
        accepts: [
          {
            scheme: 'exact',
            network: 'arbitrum-sepolia',
            asset: c.env.CODEX_USDC_ADDRESS,
            payTo: c.env.CODEX_PAY_TO_ADDRESS,
            amountUsdcWei: c.env.CODEX_MIN_PAYMENT_USDC_WEI,
            description: c.req.path,
          },
        ],
      },
      402
    );
  }

  // Facilitator is a hint; we always run the on-chain verifier.
  await verifyViaCoinbase(c, header).catch(() => undefined);

  const chainOk = await verifyOnChain(c, header);
  // Audit U-31: explicit `=== false` narrows the discriminated union to
  // `{ ok: false; reason: string }`. Pre-fix `!chainOk.ok` didn't narrow
  // under the typecheck config (the tsconfig didn't exist, so the build
  // was a no-op, the call shape was unverified). Once the missing tsconfig
  // was added (audit U-31), this turned into a real error.
  if (chainOk.ok === false) {
    return c.json({ error: 'payment_invalid', detail: chainOk.reason }, 402);
  }

  await next();
};

async function verifyViaCoinbase(c: any, header: string): Promise<void> {
  if (!c.env.COINBASE_X402_API_KEY) return;
  try {
    await fetch('https://facilitator.coinbase.com/x402/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.env.COINBASE_X402_API_KEY}`,
      },
      body: JSON.stringify({ payment: header, path: c.req.path, network: 'arbitrum-sepolia' }),
      signal: AbortSignal.timeout(2_000),
    });
    // Result is observability-only; the chain decides.
  } catch {
    // Facilitator down is fine, on-chain path is authoritative.
  }
}

async function verifyOnChain(
  c: any,
  header: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let decoded: {
    tx_hash?: `0x${string}`;
    from?: `0x${string}`;
    amount_wei?: string;
    timestamp_seconds?: number;
  };
  try {
    decoded = JSON.parse(atob(header));
  } catch {
    return { ok: false, reason: 'bad_header_encoding' };
  }
  if (!decoded.tx_hash || !/^0x[0-9a-fA-F]{64}$/.test(decoded.tx_hash)) {
    return { ok: false, reason: 'no_tx_hash' };
  }

  // Step 2: payment age. Reject anything more than 5 minutes old.
  //
  // Audit FFF-2 fix: prior code wrapped the age check in
  // `if (decoded.timestamp_seconds)`. Attacker could **omit `timestamp_seconds`
  // from the payment payload** and bypass the replay-window check entirely.
  // The D1 tx_hash UNIQUE dedup catches reused tx_hashes, but a never-before-
  // consumed OLD tx_hash (e.g. a real USDC transfer from a year ago that
  // happens to satisfy payTo + amount) would still pass.
  //
  // Now: `timestamp_seconds` is REQUIRED. Missing or non-numeric → reject.
  if (typeof decoded.timestamp_seconds !== 'number' || !Number.isFinite(decoded.timestamp_seconds)) {
    return { ok: false, reason: 'missing_timestamp' };
  }
  const ageSec = Math.floor(Date.now() / 1000) - decoded.timestamp_seconds;
  if (ageSec > PAYMENT_TTL_SECONDS) return { ok: false, reason: 'payment_too_old' };
  if (ageSec < -60) return { ok: false, reason: 'payment_in_future' };

  // Step 3: D1-backed replay dedup. If we've seen this tx_hash before, refuse.
  // The .catch fails open here because the INSERT below carries a UNIQUE
  // constraint on tx_hash that is the authoritative gate. But a D1 transient
  // here is worth surfacing so ops sees brewing storage issues before they
  // escalate to the INSERT path (where the user gets a confusing
  // `on_chain_replay_concurrent` response for a non-concurrent call).
  // Audit U-31: `c` is typed `any` (the middleware accepts variable
  // Hono contexts), so the chained .first<T>() loses its type arg.
  // Drop the generic and cast the result.
  const seen = (await c.env.DB
    .prepare('SELECT tx_hash FROM payments WHERE tx_hash = ? LIMIT 1')
    .bind(decoded.tx_hash)
    .first()
    .catch((e: unknown) => {
      console.warn('[x402] D1 replay-dedup SELECT failed; UNIQUE constraint on INSERT is the fallback gate', e);
      return null;
    })) as { tx_hash: string } | null;
  if (seen) return { ok: false, reason: 'on_chain_replay' };

  // Steps 4-6: chain verification.
  const usdcAddress = (c.env.CODEX_USDC_ADDRESS ?? '').toLowerCase();
  const expectedPayTo = (c.env.CODEX_PAY_TO_ADDRESS ?? '').toLowerCase();
  const expectedMin = BigInt(c.env.CODEX_MIN_PAYMENT_USDC_WEI ?? '0');
  // Iteration 42 audit fix: pre-fix the guard was `if (!expectedPayTo)`,
  // which catches empty string but accepts the zero address `0x0000...0`
  // (truthy in JS). The default `wrangler.toml` ships with
  // `CODEX_PAY_TO_ADDRESS = "0x0000000000000000000000000000000000000000"`
  // labelled "SET BEFORE PRODUCTION DEPLOY", but operators forget. With
  // zero-address as expected payTo, an attacker burning USDC to 0x0
  // (USDC's contract permits this) would satisfy `toAddress === expectedPayTo`
  // on line 199 → free Codex API access for the cost of the burned USDC.
  //
  // Now: reject empty string AND zero address AND any non-hex-shaped value.
  // Defense in depth, wrangler.toml's placeholder remains for backward
  // compat but the server refuses to verify against any of the unset sentinels.
  const ZERO_ADDR = '0x' + '0'.repeat(40);
  const ADDR_REGEX = /^0x[0-9a-f]{40}$/;
  if (!usdcAddress || !ADDR_REGEX.test(usdcAddress) || usdcAddress === ZERO_ADDR) {
    return { ok: false, reason: 'usdc_not_configured' };
  }
  if (!expectedPayTo || !ADDR_REGEX.test(expectedPayTo) || expectedPayTo === ZERO_ADDR) {
    return { ok: false, reason: 'pay_to_not_configured' };
  }

  let receipt: any;
  let currentBlock: bigint;
  try {
    const { createPublicClient, http } = await import('viem');
    const { arbitrumSepolia } = await import('viem/chains');
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(c.env.ARBITRUM_SEPOLIA_RPC),
    });
    receipt = await client.getTransactionReceipt({ hash: decoded.tx_hash });
    currentBlock = await client.getBlockNumber();
  } catch (err) {
    return { ok: false, reason: `chain_unreachable: ${safeErrorDetail(err, c.env)}` };
  }
  if (!receipt || receipt.status !== 'success') {
    return { ok: false, reason: 'tx_not_successful' };
  }

  // Step 4: confirmation depth.
  const confirms = Number(currentBlock - BigInt(receipt.blockNumber));
  if (confirms < CONFIRMATIONS) {
    return { ok: false, reason: `insufficient_confirmations: ${confirms}/${CONFIRMATIONS}` };
  }

  // Step 5: scan receipt logs for the USDC Transfer event paying our recipient.
  //
  // Audit BBBB-5 fix: pre-fix this loop matched `topics[2]` (to-address)
  // against `expectedPayTo` and discarded `topics[1]` (from-address). The
  // payment-record then bound `wallet_address = decoded.from`, i.e. the
  // user-supplied claim in the X-PAYMENT payload, without verifying it
  // matched the chain's actual Transfer sender. **Payment-theft
  // front-run:** Alice broadcasts a USDC tx to Atrium. Bob (or a mempool
  // bot) sees it pending, races to submit `X-PAYMENT { tx_hash:
  // alice_tx, from: BobAddr }`. Server verifies the tx + the Transfer to
  // Atrium → records consumed under BobAddr → Alice's later submission
  // hits the replay-dedup UNIQUE constraint and fails. Bob steals
  // Alice's paid Codex session.
  //
  // Fix: capture the chain-truth `from` from topics[1], reject if it
  // disagrees with the user-supplied `decoded.from` (when present), and
  // BIND the payment record to the chain `from`, never the user-claim.
  let matched = false;
  let chainFrom = '';
  for (const log of receipt.logs ?? []) {
    if ((log.address ?? '').toLowerCase() !== usdcAddress) continue;
    const topics: string[] = log.topics ?? [];
    if (topics.length < 3 || (topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue;
    const toAddress = '0x' + (topics[2] ?? '').slice(-40).toLowerCase();
    if (toAddress !== expectedPayTo) continue;
    // log.data is a single uint256 amount, hex-encoded
    let amount: bigint;
    try {
      amount = BigInt(log.data ?? '0x0');
    } catch {
      continue;
    }
    if (amount < expectedMin) continue;
    chainFrom = '0x' + (topics[1] ?? '').slice(-40).toLowerCase();
    matched = true;
    break;
  }
  if (!matched) {
    return { ok: false, reason: 'no_matching_usdc_transfer' };
  }

  // Audit BBBB-5 fix: if the user volunteered a `from`, it must match the
  // chain. Reject silent payer-spoofing. (When `decoded.from` is absent we
  // still bind to `chainFrom` below, never to 'unknown', so a missing
  // claim can't be used to evade attribution.)
  if (decoded.from && decoded.from.toLowerCase() !== chainFrom) {
    return { ok: false, reason: 'from_address_mismatch' };
  }

  // Step 7: record the tx_hash atomically. UNIQUE constraint guards against
  // a race where two requests arrive simultaneously for the same payment.
  // Bind wallet_address to the CHAIN-truth `from`, never the user claim.
  const insert = await c.env.DB
    .prepare(
      'INSERT INTO payments (id, wallet_address, path, amount_usdc_wei, tx_hash, received_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      crypto.randomUUID(),
      chainFrom,
      c.req.path,
      decoded.amount_wei ?? '0',
      decoded.tx_hash,
      Date.now()
    )
    .run()
    .catch((e: any) => ({ error: String(e?.message ?? e) }));
  if ('error' in (insert as any)) {
    // UNIQUE constraint trip-out means a concurrent request just consumed
    // this tx_hash. Refuse, exactly one request gets the payment.
    return { ok: false, reason: 'on_chain_replay_concurrent' };
  }

  return { ok: true };
}
