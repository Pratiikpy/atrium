import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock viem's dynamic import, the middleware does `await import('viem')`
// inside the function. We replace createPublicClient with one that
// returns programmable receipt + block-number responses per test.
const mockGetTransactionReceipt = vi.fn();
const mockGetBlockNumber = vi.fn();

vi.mock('viem', async () => {
  const real = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...real,
    createPublicClient: vi.fn(() => ({
      getTransactionReceipt: mockGetTransactionReceipt,
      getBlockNumber: mockGetBlockNumber,
    })),
    http: vi.fn(() => ({})),
  };
});

vi.mock('viem/chains', () => ({
  arbitrumSepolia: { id: 421614 },
}));

import { x402PaymentMiddleware } from './x402';

/**
 * Iter 73 audit fix: pins FOUR HIGH-severity audit fixes on the
 * Codex x402 payment-verification middleware. Pre-iter-73 zero tests
 * covered any of them despite the middleware being the single
 * boundary between paid + free Codex API access.
 *
 * - FFF-2: timestamp_seconds REQUIRED in the payment payload. Pre-fix
 *   the age check was wrapped in `if (decoded.timestamp_seconds)`,
 *   so an attacker omitting the field bypassed the 5-minute replay
 *   window. A real USDC tx from a year ago that satisfies payTo +
 *   amount would still pass.
 * - iter-42: zero-address payTo rejection. wrangler.toml ships with
 *   CODEX_PAY_TO_ADDRESS placeholder "0x0...0" labelled "SET BEFORE
 *   PROD". An attacker burning USDC to 0x0 (USDC permits this)
 *   would satisfy `toAddress === expectedPayTo` → free Codex API
 *   access for the cost of burned USDC.
 * - BBBB-5: payer-spoof / front-run prevention. The Transfer log's
 *   topics[1] (chain-truth from) must match decoded.from (user
 *   claim). Without this, Bob front-runs Alice's pending tx_hash
 *   submission with his own X-PAYMENT claiming `from: BobAddr`,
 *   stealing Alice's session.
 * - I-1 (confirmations): receipt must be ≥ 12 blocks deep on Arb
 *   Sepolia. Otherwise a re-org can invalidate the payment.
 */

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const USDC_ADDR = '0x' + 'a'.repeat(40);
const PAY_TO_ADDR = '0x' + 'b'.repeat(40);
const ALICE = '0x' + 'c'.repeat(40);
const BOB = '0x' + 'd'.repeat(40);
const VALID_TX = '0x' + '1'.repeat(64);

function pad32(addr: string): string {
  return '0x' + '0'.repeat(24) + addr.slice(2).toLowerCase();
}

function encodePayment(p: {
  tx_hash?: string;
  from?: string;
  amount_wei?: string;
  timestamp_seconds?: number;
}): string {
  return Buffer.from(JSON.stringify(p)).toString('base64');
}

function makeEnv(overrides: Record<string, any> = {}) {
  const db = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null), // no replay by default
        run: vi.fn().mockResolvedValue({}),
      }),
    }),
  };
  return {
    DB: db,
    ARBITRUM_SEPOLIA_RPC: 'https://rpc.example.com',
    CODEX_PAY_TO_ADDRESS: PAY_TO_ADDR,
    CODEX_MIN_PAYMENT_USDC_WEI: '1000',
    CODEX_USDC_ADDRESS: USDC_ADDR,
    ENV: 'test',
    ...overrides,
  };
}

function makeContext(env: any, paymentHeader?: string) {
  return {
    req: {
      header: (name: string) => (name === 'X-PAYMENT' ? paymentHeader : undefined),
      path: '/v1/margin/buying-power',
    },
    env,
    json: vi.fn((body, status) => ({ body, status: status ?? 200 })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTransactionReceipt.mockReset();
  mockGetBlockNumber.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('x402PaymentMiddleware, missing X-PAYMENT', () => {
  it('returns 402 with accepts catalogue when header absent', async () => {
    const env = makeEnv();
    const c = makeContext(env);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'payment_required',
        accepts: expect.any(Array),
      }),
      402,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('x402PaymentMiddleware, FFF-2 timestamp_seconds required', () => {
  it('rejects payment missing timestamp_seconds', async () => {
    const header = encodePayment({ tx_hash: VALID_TX });
    const c = makeContext(makeEnv(), header);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    // FFF-2: pre-fix this WOULD have passed (the age check was wrapped
    // in `if (decoded.timestamp_seconds)`). Post-fix: reject loudly.
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'missing_timestamp' },
      402,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects payment with non-numeric timestamp_seconds', async () => {
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: 'not-a-number' as any,
    });
    const c = makeContext(makeEnv(), header);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'missing_timestamp' },
      402,
    );
  });

  it('rejects payment older than 5 minutes', async () => {
    const stale = Math.floor(Date.now() / 1000) - 6 * 60; // 6 min ago
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: stale,
    });
    const c = makeContext(makeEnv(), header);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'payment_too_old' },
      402,
    );
  });

  it('rejects payment from the future (clock-skew guard)', async () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 60; // 5 min in future
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: future,
    });
    const c = makeContext(makeEnv(), header);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'payment_in_future' },
      402,
    );
  });
});

describe('x402PaymentMiddleware, iter-42 zero-address payTo rejection', () => {
  it('rejects when CODEX_PAY_TO_ADDRESS is the zero address', async () => {
    const env = makeEnv({ CODEX_PAY_TO_ADDRESS: '0x' + '0'.repeat(40) });
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(c, next);
    // iter-42 critical: pre-fix would have accepted a Transfer to 0x0
    // (USDC permits burn-to-zero) → free API access.
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'pay_to_not_configured' },
      402,
    );
  });

  it('rejects when CODEX_PAY_TO_ADDRESS is empty string', async () => {
    const env = makeEnv({ CODEX_PAY_TO_ADDRESS: '' });
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'pay_to_not_configured' },
      402,
    );
  });

  it('rejects when CODEX_PAY_TO_ADDRESS is malformed (not 0x-prefixed 40-hex)', async () => {
    const env = makeEnv({ CODEX_PAY_TO_ADDRESS: 'notanaddress' });
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'pay_to_not_configured' },
      402,
    );
  });

  it('rejects when CODEX_USDC_ADDRESS is the zero address', async () => {
    const env = makeEnv({ CODEX_USDC_ADDRESS: '0x' + '0'.repeat(40) });
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'usdc_not_configured' },
      402,
    );
  });
});

describe('x402PaymentMiddleware, BBBB-5 payer-spoof / front-run prevention', () => {
  it('rejects when decoded.from disagrees with chain Transfer from', async () => {
    // Alice broadcast a tx paying PAY_TO_ADDR. Bob intercepts the
    // tx_hash and submits X-PAYMENT { tx_hash: alice_tx, from: BOB }.
    // BBBB-5: server must reject because chain says Alice, not Bob.
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n); // 100 confirms > 12

    const header = encodePayment({
      tx_hash: VALID_TX,
      from: BOB, // ← the front-run lie
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'from_address_mismatch' },
      402,
    );
  });

  it('binds payment record to CHAIN from, not user-claimed from', async () => {
    // When decoded.from is omitted entirely, the route still records
    // wallet_address = chainFrom. The DB INSERT call captures this.
    let bindCall: any[] | undefined;
    const env = makeEnv();
    env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn((...args: any[]) => {
        bindCall = args;
        return {
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({}),
        };
      }),
    });

    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      // from intentionally omitted, must NOT default to 'unknown'.
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(makeContext(env, header), next);
    expect(next).toHaveBeenCalled();
    // INSERT bind args are (id, wallet_address, path, amount, tx_hash, ts).
    // wallet_address (index 1) must be the chain Alice, not 'unknown' / null / Bob.
    expect(bindCall![1]).toBe(ALICE.toLowerCase());
  });

  it('accepts when decoded.from matches chain from (case-insensitive)', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      from: ALICE.toUpperCase(), // user-supplied; case-insensitive compare
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(makeContext(makeEnv(), header), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('x402PaymentMiddleware, I-1 confirmation depth', () => {
  it('rejects when receipt is fewer than 12 blocks deep', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [],
    });
    mockGetBlockNumber.mockResolvedValue(105n); // 5 confirms < 12

    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'payment_invalid',
        detail: expect.stringContaining('insufficient_confirmations'),
      }),
      402,
    );
  });

  it('rejects when receipt status is failure', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'reverted',
      blockNumber: 100n,
      logs: [],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'tx_not_successful' },
      402,
    );
  });
});

describe('x402PaymentMiddleware, payload + replay checks', () => {
  it('rejects malformed base64 header', async () => {
    const c = makeContext(makeEnv(), '!!!not-base64!!!');
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'bad_header_encoding' },
      402,
    );
  });

  it('rejects header missing tx_hash', async () => {
    const header = encodePayment({ timestamp_seconds: Math.floor(Date.now() / 1000) });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'no_tx_hash' },
      402,
    );
  });

  it('rejects header with malformed tx_hash', async () => {
    const header = encodePayment({
      tx_hash: '0xshort' as any,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'no_tx_hash' },
      402,
    );
  });

  it('rejects tx_hash that has already been consumed', async () => {
    const env = makeEnv();
    // SELECT returns a row → seen → replay refusal.
    env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ tx_hash: VALID_TX }),
        run: vi.fn(),
      }),
    });
    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'on_chain_replay' },
      402,
    );
  });

  it('rejects when no matching USDC Transfer to payTo found', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        // Transfer to a DIFFERENT address, not payTo.
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(BOB)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'no_matching_usdc_transfer' },
      402,
    );
  });

  it('rejects when Transfer amount is below CODEX_MIN_PAYMENT_USDC_WEI', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (500n).toString(16).padStart(64, '0'), // < 1000 min
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(makeEnv(), header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'no_matching_usdc_transfer' },
      402,
    );
  });

  it('rejects when INSERT hits UNIQUE constraint (concurrent replay)', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const env = makeEnv();
    env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null), // no prior seen
        run: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed')),
      }),
    });

    const header = encodePayment({
      tx_hash: VALID_TX,
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const c = makeContext(env, header);
    await (x402PaymentMiddleware as any)(c, vi.fn());
    expect(c.json).toHaveBeenCalledWith(
      { error: 'payment_invalid', detail: 'on_chain_replay_concurrent' },
      402,
    );
  });
});

describe('x402PaymentMiddleware, happy path', () => {
  it('calls next() when every check passes', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 100n,
      logs: [
        {
          address: USDC_ADDR,
          topics: [TRANSFER_TOPIC, pad32(ALICE), pad32(PAY_TO_ADDR)],
          data: '0x' + (10000n).toString(16).padStart(64, '0'),
        },
      ],
    });
    mockGetBlockNumber.mockResolvedValue(200n);

    const header = encodePayment({
      tx_hash: VALID_TX,
      from: ALICE,
      amount_wei: '10000',
      timestamp_seconds: Math.floor(Date.now() / 1000),
    });
    const next = vi.fn();
    await (x402PaymentMiddleware as any)(makeContext(makeEnv(), header), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
