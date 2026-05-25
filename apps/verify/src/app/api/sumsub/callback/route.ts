import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * POST /api/sumsub/callback  Sumsub KYC webhook receiver.
 *
 * Phase eta.3 (2026-05-25). When a Sumsub KYC applicant reaches the
 * `applicantReviewed` event with a green decision, this handler reads
 * the applicant's wallet address (passed as externalUserId) and calls
 * Edict.assignTier(wallet, tier) via the Praetor multisig EOA so the
 * user's tier auto-advances rather than waiting on manual ops.
 *
 * Founder ops:
 *   1. Sumsub sandbox: create account at sumsub.com, copy the secret
 *      token + webhook URL.
 *   2. Set env: SUMSUB_WEBHOOK_SECRET, EDICT_CONTRACT_ADDR,
 *      PRAETOR_MULTISIG_KEY.
 *   3. In Sumsub dashboard . Integrations . Webhooks: add
 *      https://verify.atrium.fi/api/sumsub/callback with the secret.
 *
 * Security: verifies HMAC SHA-256 signature header before processing,
 * per Sumsub docs. Replays + spoofs rejected with 401.
 */

export const dynamic = 'force-dynamic';

interface SumsubEvent {
  type: string;
  applicantId: string;
  externalUserId?: string;
  reviewResult?: { reviewAnswer: 'GREEN' | 'RED'; rejectLabels?: string[] };
  reviewStatus?: string;
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'sumsub_not_configured', detail: 'SUMSUB_WEBHOOK_SECRET pending founder provisioning' },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-payload-digest');
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: SumsubEvent;
  try {
    event = JSON.parse(rawBody) as SumsubEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (event.type !== 'applicantReviewed') {
    return NextResponse.json({ ok: true, ignored: event.type });
  }
  if (event.reviewResult?.reviewAnswer !== 'GREEN') {
    return NextResponse.json({
      ok: true,
      ignored: 'review_not_green',
      labels: event.reviewResult?.rejectLabels,
    });
  }
  const wallet = event.externalUserId;
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'invalid_external_user_id' }, { status: 400 });
  }

  // Call Edict.assignTier(wallet, 2, proof). Tier 2 = KYC-verified retail.
  //
  // Phase theta audit follow-up (2026-05-25): the contract signature is
  // `assignTier(address user, UserTier tier, bytes32 proof)` — 3 args.
  // Pre-fix this route declared the function with only 2 args, which
  // computed a different keccak256 selector than the deployed contract.
  // Every Sumsub callback reverted at the EVM dispatch table with
  // "no matching function" — Year-1 KYC tier upgrades were entirely
  // broken in silence. Sumsub retries up to 3x then gives up; the
  // failure mode is "user completes KYC but stays at Tier 0 forever".
  //
  // Now: 3-arg ABI, and proof = keccak256(applicantId) so the same
  // applicantId never replays. Edict's assignTier marks _processed_proofs
  // on success, so two callbacks for the same applicantId only assign once.
  const praetorKey = process.env.PRAETOR_MULTISIG_KEY;
  const edictAddr = process.env.EDICT_CONTRACT_ADDR;
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
  if (!praetorKey || !edictAddr) {
    return NextResponse.json({
      ok: true,
      warning: 'praetor key or Edict address not configured; tier assignment deferred',
      wallet,
    });
  }
  try {
    const { createWalletClient, http, keccak256, toBytes } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { arbitrumSepolia } = await import('viem/chains');
    const account = privateKeyToAccount(praetorKey as `0x${string}`);
    const client = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) });
    // Proof = keccak256(applicantId). Edict's _processed_proofs mapping
    // ensures a single applicantId yields a single tier assignment even
    // if Sumsub retries the webhook.
    const proof = keccak256(toBytes(event.applicantId));
    const tx = await client.writeContract({
      address: edictAddr as `0x${string}`,
      abi: [{
        type: 'function',
        name: 'assignTier',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'user', type: 'address' },
          { name: 'tier', type: 'uint8' },
          { name: 'proof', type: 'bytes32' },
        ],
        outputs: [],
      }] as const,
      functionName: 'assignTier',
      args: [wallet as `0x${string}`, 2, proof],
    });
    return NextResponse.json({ ok: true, wallet, tx, arbiscan: `https://sepolia.arbiscan.io/tx/${tx}` });
  } catch (err) {
    return NextResponse.json(
      { ok: false, wallet, error: 'tier_assign_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
