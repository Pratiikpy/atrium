import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * QA 2026-06-02: locks the pause-state route that closed the silent-failure
 * where useContractPaused 404'd and always fell back to paused:false (a pause
 * guard that never tripped). The route must read real Scribe pause singletons,
 * label not-indexed slugs honestly, and degrade to pending on a Scribe outage,
 * never inventing a state.
 */
const req = (qs: string) => new Request(`http://t/api/protocol/pause-state${qs}`);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('GET /api/protocol/pause-state', () => {
  it('400s on a missing contract param', async () => {
    const { GET } = await import('./route');
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('returns not-indexed (no Scribe call) for vigil/sigil/router', async () => {
    const { GET } = await import('./route');
    for (const slug of ['vigil', 'sigil', 'router']) {
      const json = await (await GET(req(`?contract=${slug}`))).json();
      expect(json).toEqual({ paused: false, source: 'not-indexed' });
    }
    expect(gql).not.toHaveBeenCalled();
  });

  it('reads aqueduct isPaused from Scribe', async () => {
    (gql as any).mockResolvedValue({ aqueductPauseState: { isPaused: true } });
    const { GET } = await import('./route');
    const json = await (await GET(req('?contract=aqueduct'))).json();
    expect(json).toEqual({ paused: true, source: 'scribe' });
  });

  it('reads plinth isGloballyPaused from Scribe', async () => {
    (gql as any).mockResolvedValue({ plinthPauseState: { isGloballyPaused: true } });
    const { GET } = await import('./route');
    const json = await (await GET(req('?contract=plinth'))).json();
    expect(json).toEqual({ paused: true, source: 'scribe' });
  });

  it('coffer is paused if EITHER deposits or withdrawals are paused', async () => {
    (gql as any).mockResolvedValue({
      cofferPauseState: { isDepositsPaused: false, isWithdrawalsPaused: true },
    });
    const { GET } = await import('./route');
    const json = await (await GET(req('?contract=coffer'))).json();
    expect(json.paused).toBe(true);
    expect(json.withdrawalsPaused).toBe(true);
    expect(json.depositsPaused).toBe(false);
    expect(json.source).toBe('scribe');
  });

  it('degrades to pending on a Scribe outage, never inventing a state', async () => {
    (gql as any).mockRejectedValue(new Error('scribe down'));
    const { GET } = await import('./route');
    const json = await (await GET(req('?contract=aqueduct'))).json();
    expect(json).toEqual({ paused: false, source: 'pending' });
  });
});
