import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock portfolio-source so tryGetPlinth returns a programmable client.
vi.mock('@/lib/portfolio-source', () => ({
  tryGetPlinth: vi.fn(),
}));

import { tryGetPlinth } from '@/lib/portfolio-source';

/**
 * Iter 63 audit fix: locks the LL-7 + LL-8 fixes on
 * /api/portfolio/margin-health that had zero tests pinning them.
 *
 * - LL-7: collateralBarWidthBps used to be `(collateral * 10_000n) /
 *   (required + 1n)` as a divide-by-zero guard. But `required === 0n`
 *   is already special-cased above; the `+ 1n` introduced an
 *   off-by-up-to-2× precision error when required was small (e.g.
 *   required=1 → bar width = 5_000 instead of 10_000). Now: exact
 *   ratio when non-zero, full bar when zero.
 * - LL-8: ratio is a BigInt that can exceed Number.MAX_SAFE_INTEGER
 *   on tiny `required` values. Clamp to 1_000_000 before Number cast
 *   so marginHealthBps doesn't ship corrupted to the UI.
 *
 * The route's contract: source = 'plinth' on success, 'pending' on
 * Plinth absence OR contract-read failure.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

function fakePlinth(collateral: bigint, required: bigint) {
  return {
    read: {
      getAccount: vi.fn().mockResolvedValue([collateral, required, 0n, false] as [bigint, bigint, bigint, boolean]),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.DEMO_WALLET_ADDRESS = TEST_WALLET;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_WALLET;
});

describe('GET /api/portfolio/margin-health, LL-7 (no +1n bias)', () => {
  it('returns 10_000 bar width when required=0 (special-case)', async () => {
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(100_000n, 0n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // required=0: special-cased to 10_000 (full bar). Without the
    // special-case the divide-by-zero guard would have engaged.
    expect(json.collateralBars[0].widthBps).toBe(10_000);
    // ratio also defaults to 10_000n in the required=0 branch.
    expect(json.marginHealthBps).toBe(10_000);
  });

  it('returns exact bar width on small required (LL-7 pre-fix would mis-halve)', async () => {
    // Pre-LL-7: (collateral * 10_000n) / (required + 1n) with required=1
    //          = (10_000 * 10_000) / 2 = 50_000 → clamped to 10_000.
    //          Looks fine here BUT the same denominator-shift causes
    //          a 1:1 bar to render at ~50% width when required=1 and
    //          collateral=1: 10_000 / 2 = 5_000 instead of 10_000.
    // Post-LL-7: required=1, collateral=1 → exactly 10_000.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1n, 1n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // 1:1 collateral/required ratio = 10_000 bps (full health), bar
    // should be exactly 10_000 not 5_000. This is the load-bearing
    // LL-7 assertion.
    expect(json.collateralBars[0].widthBps).toBe(10_000);
  });

  it('clamps bar width at 10_000 when collateral exceeds required', async () => {
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_000_000n, 100_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // ratio = 100_000 bps, clamped to 10_000 for bar rendering.
    expect(json.collateralBars[0].widthBps).toBe(10_000);
  });
});

describe('GET /api/portfolio/margin-health, LL-8 (BigInt-to-Number clamp)', () => {
  it('clamps marginHealthBps at 1_000_000 on absurd ratio', async () => {
    // collateral 1e30 wei vs required 1 wei → ratio = 1e34, way past
    // Number.MAX_SAFE_INTEGER. LL-8 clamp keeps the output bounded
    // and a clean integer.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(10n ** 30n, 1n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.marginHealthBps).toBe(1_000_000);
    // bufferBps also clamps via Math.min(1_000_000, ...). Same cap.
    expect(json.liquidationBufferBps).toBe(1_000_000);
  });

  it('returns a finite integer for typical healthy account', async () => {
    // 200% collateralization: collateral=2x, required=x → ratio=20_000 bps.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(2_000n, 1_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.marginHealthBps).toBe(20_000);
    expect(json.liquidationBufferBps).toBe(10_000); // ratio - 10_000
  });

  it('returns 0 buffer when ratio is at or below 10_000', async () => {
    // 100% collateralization = ratio 10_000. Buffer above the
    // liquidation line is exactly 0.
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_000n, 1_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.marginHealthBps).toBe(10_000);
    expect(json.liquidationBufferBps).toBe(0);
  });

  it('returns 0 buffer when under-collateralized (ratio < 10_000)', async () => {
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(500n, 1_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.marginHealthBps).toBe(5_000);
    expect(json.liquidationBufferBps).toBe(0);
  });
});

describe('GET /api/portfolio/margin-health, pending paths', () => {
  it('returns pending when plinth is unavailable', async () => {
    (tryGetPlinth as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.marginHealthBps).toBeNull();
    expect(json.liquidationBufferBps).toBeNull();
    expect(json.collateralBars).toEqual([]);
  });

  it('returns pending when wallet env unset (even if plinth is available)', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_000n, 1_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns pending when getAccount throws (Plinth revert)', async () => {
    const plinth = {
      read: { getAccount: vi.fn().mockRejectedValue(new Error('Plinth revert')) },
    };
    (tryGetPlinth as any).mockResolvedValue(plinth);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.marginHealthBps).toBeNull();
  });

  it('renders source:plinth on successful read', async () => {
    (tryGetPlinth as any).mockResolvedValue(fakePlinth(1_500n, 1_000n));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('plinth');
  });
});
