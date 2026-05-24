import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 69 audit fix: locks the VV-3 fix on /api/agents/leaderboard.
 *
 * - VV-3: pre-fix the route sourced `copiers: count` from a Sigil
 *   validation count and shipped `source: 'rostrum'`. Silent
 *   semantic substitution — sigil validation ("agent acting under a
 *   mandate") is not the same as Rostrum copier count ("users
 *   following this agent"). Two different concepts conflated.
 *
 *   The honest fix: return source:pending + empty agents until
 *   Rostrum lands in the subgraph (human_left.md #26).
 *
 * Without these tests, a refactor "lighting up" the leaderboard by
 * pointing it back at sigilValidations would slip past CI.
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/agents/leaderboard — VV-3 semantic-substitution prevention', () => {
  it('always returns source:pending regardless of Scribe data', async () => {
    // Even when Scribe has plenty of sigilValidations, the route must
    // NOT use them as copier counts. source = pending.
    (gql as any).mockResolvedValue({
      sigilValidations: [
        { agent: '0x' + 'a'.repeat(40), timestamp: '1700000000' },
        { agent: '0x' + 'b'.repeat(40), timestamp: '1700000100' },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.agents).toEqual([]);
  });

  it('returns source:pending even when Scribe probe fails (no leak)', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe down'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.agents).toEqual([]);
  });

  it('explains the pending state in the detail field', async () => {
    (gql as any).mockResolvedValue({ sigilValidations: [] });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // The detail string names the actual blocker so a downstream
    // consumer / operator can find the root cause without spelunking.
    expect(json.detail).toContain('Rostrum');
    expect(json.detail).toContain('subgraph');
  });

  it('never returns source:rostrum (semantic substitution gate)', async () => {
    // Pre-VV-3 the route shipped source:'rostrum' built from sigil
    // counts. Multiple input shapes must all keep source:pending.
    for (const data of [
      { sigilValidations: [] },
      { sigilValidations: [{ agent: '0xa', timestamp: '1700000000' }] },
      { sigilValidations: [{ agent: null, timestamp: '1700000000' }] },
    ]) {
      (gql as any).mockResolvedValue(data);
      const { GET } = await import('./route');
      const json = await (await GET()).json();
      expect(json.source).not.toBe('rostrum');
      expect(json.source).toBe('pending');
    }
  });

  it('issues exactly one gql probe per request (readiness check)', async () => {
    (gql as any).mockResolvedValue({ sigilValidations: [] });
    const { GET } = await import('./route');
    await GET();
    expect(gql).toHaveBeenCalledTimes(1);
  });
});
