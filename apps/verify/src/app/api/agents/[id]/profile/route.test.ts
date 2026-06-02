import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Per-agent profile from Scribe; honest pending when the subgraph is empty. */

const gql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/scribe-helpers', () => ({ gql }));

import { GET } from './route';

function call(id: string) {
  return GET(new Request('http://localhost/x'), { params: Promise.resolve({ id }) });
}

beforeEach(() => gql.mockReset());

describe('GET /api/agents/[id]/profile', () => {
  it('400 invalid_id when id is empty', async () => {
    const r = await call('');
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('invalid_id');
  });

  it('400 invalid_id when id exceeds 64 chars', async () => {
    const r = await call('x'.repeat(65));
    expect(r.status).toBe(400);
  });

  it('honest pending (null counts) when the subgraph has no rows', async () => {
    gql.mockResolvedValue({ rostrumReputation: null, rostrumLeaderDeboosts: [], rostrumMirrorTrades: [], rostrumAgentActions: [] });
    const j = await (await call('augur')).json();
    expect(j.source).toBe('pending');
    expect(j.totalActions).toBeNull();
  });

  it('source scribe with real counts when actions exist', async () => {
    gql.mockResolvedValue({
      rostrumReputation: { tier: 'gold', deboostHistory: '' },
      rostrumLeaderDeboosts: [],
      rostrumMirrorTrades: [],
      rostrumAgentActions: [{ kind: 'OPEN', at: '1' }, { kind: 'REVERTED', at: '2' }],
    });
    const j = await (await call('augur')).json();
    expect(j.source).toBe('scribe');
    expect(j.totalActions).toBe(2);
    expect(j.successfulActions).toBe(1);
    expect(j.revertedActions).toBe(1);
    expect(j.reputationTier).toBe('gold');
  });

  it('falls back to a pending profile on a malformed Scribe response (no fake zeros)', async () => {
    // A null/garbage response makes the route throw while destructuring inside
    // its try -> the catch returns the honest empty profile.
    gql.mockResolvedValue(null);
    const j = await (await call('augur')).json();
    expect(j.source).toBe('pending');
    expect(j.deboostEvents).toEqual([]);
  });
});
