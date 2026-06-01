import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Audit U-34: lock the invariant that verify-app routes treat
 * BigInt-zero-defaulted subgraph fields as "not yet measured" (null in
 * the wire response) rather than as a measured-zero ("$0", "0.00",
 * "flat", etc.).
 *
 * Subgraph mappings initialize entity fields to `BigInt.zero()` because
 * AssemblyScript requires every field to be populated at entity-load
 * time. Those zeros propagate through Scribe to routes that format them
 *, and a route that does `formatUsd(zeroBigInt)` ships "$0.00" as if
 * measured. The U-33 audit closed this for /api/portfolio/positions'
 * entryPriceQ64. This test pins the same invariant route-by-route so
 * a new route can't reintroduce the pattern.
 *
 * Scope: the routes whose schema queries name a field documented as
 * "ships zero until contract-event-v2" in subgraph/src/*. Add new rows
 * here when extending the schema.
 */

const ORIG_WALLET = process.env.DEMO_WALLET_ADDRESS;
const WALLET = '0x' + 'a'.repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.DEMO_WALLET_ADDRESS = WALLET;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIG_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIG_WALLET;
});

describe('U-34: subgraph zero-defaults stay null in wire responses', () => {
  it('positions/route.ts: entryPriceQ64=0 → entryPrice null (U-33 lock)', async () => {
    (gql as any).mockResolvedValue({
      positions: [
        {
          id: '1',
          venueId: 1,
          instrumentId: '0xabc',
          notionalSigned: '1000000',
          entryPriceQ64: '0',
          closedAtBlock: null,
        },
      ],
    });
    const { GET } = await import('./portfolio/positions/route');
    // Phase theta audit follow-up: route GET signature now requires a
    // Request to support the ?wallet= multi-tenant param. Pass a stub
    // request; the env-fallback path still applies because the URL has
    // no `wallet` query param.
    const json = await (await GET(new Request('http://localhost/api/portfolio/positions'))).json();
    expect(json.positions[0].entryPrice).toBeNull();
    // Sanity: a non-zero entryPriceQ64 should still produce a real value.
    (gql as any).mockResolvedValue({
      positions: [
        {
          id: '2',
          venueId: 1,
          instrumentId: '0xabc',
          notionalSigned: '1000000',
          entryPriceQ64: ((100n) << 64n).toString(),
          closedAtBlock: null,
        },
      ],
    });
    const { GET: GET2 } = await import('./portfolio/positions/route');
    const json2 = await (await GET2(new Request('http://localhost/api/portfolio/positions'))).json();
    expect(json2.positions[0].entryPrice).toBe('$100');
  });

  it('positions/route.ts: markPrice + pnlUsd never claim measured-zero', async () => {
    // U-21 already locked this for the success path; re-assert here
    // alongside the other zero-default checks so the invariant lives in
    // one place going forward.
    (gql as any).mockResolvedValue({
      positions: [
        {
          id: '3',
          venueId: 1,
          instrumentId: '0xabc',
          notionalSigned: '1000000',
          entryPriceQ64: ((250n) << 64n).toString(),
          closedAtBlock: null,
        },
      ],
    });
    const { GET } = await import('./portfolio/positions/route');
    // Phase theta audit follow-up: route GET signature now requires a
    // Request to support the ?wallet= multi-tenant param. Pass a stub
    // request; the env-fallback path still applies because the URL has
    // no `wallet` query param.
    const json = await (await GET(new Request('http://localhost/api/portfolio/positions'))).json();
    expect(json.positions[0].markPrice).toBeNull();
    expect(json.positions[0].pnlUsd).toBeNull();
    expect(json.positions[0].pnlDirection).toBeNull();
  });
});
