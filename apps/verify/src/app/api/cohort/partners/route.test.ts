import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the gql helper BEFORE importing the route, since the route uses a
// static import of `gql` from '@/lib/scribe-helpers'.
vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { GET } from './route';
import { gql } from '@/lib/scribe-helpers';

/**
 * Locks the honest empty-state pattern for the cohort partners endpoint.
 *
 * Per .claude/rules/ui.md "Live data discipline": never fake numbers, never
 * silently swallow failures. The route returns one of two shapes:
 *   - `{ partners: [...], source: 'scribe' }` on a successful gql response
 *   - `{ partners: [], source: 'pending' }` on ANY failure (network, timeout, etc.)
 *
 * The UI uses `source` to render either a real list or the honest empty
 * state — so this route's contract is the foundation of the
 * never-fake-numbers invariant for cohort data.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/cohort/partners — happy path', () => {
  it('maps gql cohortPartners → {partners, source:scribe}', async () => {
    (gql as any).mockResolvedValue({
      cohortPartners: [
        { id: '0xaaaa', displayName: 'Wintermute' },
        { id: '0xbbbb', displayName: 'Selini' },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('scribe');
    expect(json.partners).toHaveLength(2);
    expect(json.partners[0]).toEqual({ id: '0xaaaa', name: 'Wintermute' });
    expect(json.partners[1]).toEqual({ id: '0xbbbb', name: 'Selini' });
  });

  it('falls back to id.slice(0, 10) when displayName is null', async () => {
    // PRD §"Live data discipline": a partner who hasn't set a displayName
    // gets their shortened address shown, NOT a placeholder name.
    (gql as any).mockResolvedValue({
      cohortPartners: [{ id: '0x1234567890abcdef', displayName: null }],
    });

    const json = await (await GET()).json();
    expect(json.partners[0].name).toBe('0x12345678');
    // id.slice(0, 10) yields 10 chars (0x + 8 hex). Locks the truncation
    // length so a refactor doesn't change the format.
    expect(json.partners[0].name.length).toBe(10);
  });

  it('returns empty partners + source:scribe when gql returns empty list', async () => {
    // Different from the "pending" empty state: a successful Scribe call
    // that returns zero partners is still source:scribe (we know it's empty).
    (gql as any).mockResolvedValue({ cohortPartners: [] });

    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    expect(json.partners).toEqual([]);
  });

  it('handles cohortPartners being undefined (defensive)', async () => {
    // The route's `?? []` fallback must produce a clean empty array
    // when Scribe's response omits the field entirely.
    (gql as any).mockResolvedValue({});
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
    expect(json.partners).toEqual([]);
  });
});

describe('GET /api/cohort/partners — honest pending on failure', () => {
  it('returns source:pending when gql throws Scribe 5xx', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe 502'));
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.partners).toEqual([]);
  });

  it('returns source:pending when gql throws "empty"', async () => {
    (gql as any).mockRejectedValue(new Error('empty'));
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns source:pending on subgraph reorg / sync errors', async () => {
    // Real-world Scribe error mid-deploy or post-reorg. The route MUST
    // fall back to the honest empty state, not crash.
    (gql as any).mockRejectedValue(new Error('Subgraph not synced past block 9999'));
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns source:pending on AbortError (audit P-7 timeout)', async () => {
    // If gql times out via the audit-P-7 3s AbortSignal, the route must
    // STILL respond with the empty-state payload.
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    (gql as any).mockRejectedValue(abortErr);
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
  });

  it('returns 200 (not 500) even on gql failure — never breaks the UI', async () => {
    // The UI polls this every 30s; if it ever 5xx'd, the cohort section
    // would error-boundary while real Scribe outages are momentary.
    (gql as any).mockRejectedValue(new Error('Network connection failed'));
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe('GET /api/cohort/partners — response shape invariants', () => {
  it('always returns {partners: [...], source: ...} regardless of state', async () => {
    // Test every branch produces the canonical shape.
    const scenarios = [
      () => (gql as any).mockResolvedValue({ cohortPartners: [{ id: '0x1', displayName: 'X' }] }),
      () => (gql as any).mockResolvedValue({ cohortPartners: [] }),
      () => (gql as any).mockResolvedValue({}),
      () => (gql as any).mockRejectedValue(new Error('any error')),
    ];

    for (const setup of scenarios) {
      vi.clearAllMocks();
      setup();
      const json = await (await GET()).json();
      expect(json).toHaveProperty('partners');
      expect(json).toHaveProperty('source');
      expect(Array.isArray(json.partners)).toBe(true);
      expect(['scribe', 'pending']).toContain(json.source);
    }
  });
});
