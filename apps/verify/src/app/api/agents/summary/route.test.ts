import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 69 audit fix: locks JJ-6 + JJ-7 + iter-37 on /api/agents/summary.
 *
 * - JJ-6: null-agent type-guard. Pre-fix `validations.map(v =>
 *   v.agent.toLowerCase())` threw TypeError on null Scribe fields
 *   (real during schema rollovers / partial sync). The route's
 *   catch then swallowed the throw and the WHOLE response went
 *   pending, even though most rows were valid. Fix: typeof === 'string'
 *   guard, count only valid rows, drop the bad ones.
 * - JJ-7: activeSessionKeys is a Postern concept (ERC-7715 session
 *   keys), distinct from Sigil mandates. Pre-fix both fields
 *   reported the same number. Fix: activeSessionKeys = null until a
 *   Postern subgraph entity exists.
 * - iter-37: agentsCopied / agentsByVenues / feesPaidUsd / feeAgentsCount
 *   were hardcoded to 0 in both success AND pending paths. The
 *   client (stat-row.tsx) had `data?.field ?? '-'` which returns 0
 *   for non-nullish values → UI rendered "0 agents copied" as if
 *   measured. Fix: null in both paths.
 * - iter-37 (critical UX): activeMandates=null in the catch path.
 *   Pre-fix: a Scribe outage shipped activeMandates:0, leading
 *   users with real mandates to panic-press Kill Switch thinking
 *   their delegations were revoked. Null = honest unknown.
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/agents/summary, JJ-6 null-agent type-guard', () => {
  it('counts only string-typed agents from sigilValidations', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [
        { agent: '0xaa' },
        { agent: null }, // bad row, dropped
        { agent: '0xbb' },
        { agent: '0xcc' },
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBe(3);
    expect(json.source).toBe('scribe');
  });

  it('dedupes case-insensitively (.toLowerCase() applied)', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [{ agent: '0xAA' }, { agent: '0xaa' }, { agent: '0xBB' }],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBe(2);
  });

  it('subtracts revoked agents from the active set', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [{ agent: '0xaa' }, { agent: '0xbb' }, { agent: '0xcc' }],
      sigilRevocations: [{ agent: '0xbb' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBe(2);
  });

  it('survives null-agent in revocations array', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [{ agent: '0xaa' }],
      sigilRevocations: [{ agent: null }, { agent: '0xaa' }],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBe(0);
  });
});

describe('GET /api/agents/summary, JJ-7 + iter-37 honesty nulls', () => {
  it('returns activeSessionKeys:null in success path (JJ-7)', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [{ agent: '0xaa' }],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Critical: not the same number as activeMandates. Postern-side
    // data doesn't exist in subgraph yet.
    expect(json.activeSessionKeys).toBeNull();
  });

  it('returns iter-37 fields as null (NOT zero) in success path', async () => {
    (gql as any).mockResolvedValue({
      sigilValidations: [{ agent: '0xaa' }],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.agentsCopied).toBeNull();
    expect(json.agentsByVenues).toBeNull();
    expect(json.feesPaidUsd).toBeNull();
    expect(json.feeAgentsCount).toBeNull();
    expect(json.totalCapacityUsd).toBeNull();
    expect(json.capacityUsedPct).toBeNull();
  });

  it('returns activeMandates:0 (not null) when valid empty Scribe response', async () => {
    // Boundary: empty arrays from Scribe → 0 mandates is a real
    // measurement (zero validations seen), NOT pending. iter-37 only
    // applies nulls to fields without a real source.
    (gql as any).mockResolvedValue({
      sigilValidations: [],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBe(0);
    expect(json.source).toBe('scribe');
  });
});

describe('GET /api/agents/summary, iter-37 catch-path UX safety (NO false zero)', () => {
  it('returns activeMandates:NULL on Scribe failure (NOT 0)', async () => {
    // The load-bearing UX-safety assertion. Pre-iter-37 the catch
    // returned activeMandates:0 → users with real mandates saw "0
    // active mandates" during a Scribe outage and could panic-press
    // Kill Switch. Null = "we don't know" = UI renders "-" + pending.
    (gql as any).mockRejectedValue(new Error('Scribe 503'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBeNull();
    expect(json.source).toBe('pending');
  });

  it('returns ALL fields as null on Scribe failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe timeout'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activeMandates).toBeNull();
    expect(json.activeSessionKeys).toBeNull();
    expect(json.totalCapacityUsd).toBeNull();
    expect(json.capacityUsedPct).toBeNull();
    expect(json.agentsCopied).toBeNull();
    expect(json.agentsByVenues).toBeNull();
    expect(json.feesPaidUsd).toBeNull();
    expect(json.feeAgentsCount).toBeNull();
    expect(json.source).toBe('pending');
  });
});
