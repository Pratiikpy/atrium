import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 64 audit fix: locks KK-8 / KK-9 / KK-10 on
 * /api/portfolio/activity. Zero tests pinned them pre-iter-64.
 *
 * - KK-8 / sort by unix: pre-fix the feed sorted by the human "Xm
 *   ago" string, which is lexical. "10m ago" < "2m ago"
 *   alphabetically, so the feed showed older items above newer ones
 *   whenever any item crossed 10 / 100 / 1000 of a unit. Same as
 *   audit S-6 fix in notifications/route.ts.
 * - KK-9 / drop NaN timestamps: parseTsOrNull rejects malformed
 *   Scribe timestamps (empty, NaN-text, negative, year-9999+). Skip
 *   instead of pushing "NaN s ago" rows.
 * - KK-10 / null-agent dropping: sigilValidations from Scribe may
 *   carry `agent: null`. The route's `.slice(0, 8)` would throw
 *   on null; we drop the row instead of crashing the whole feed.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const TEST_WALLET = '0x' + 'a'.repeat(40);

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

describe('GET /api/portfolio/activity — KK-8 unix sort', () => {
  it('sorts activities by unix timestamp desc, not by ago() lexical', async () => {
    // Three margin updates spanning timestamps where the lexical sort
    // of `ago()` would flip the order. Pre-KK-8: "10m ago" < "2m ago"
    // alphabetically. Post-KK-8: 1700000600 > 1700000060 > 1700000000
    // numerically — order is newest first.
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000' }, // oldest
        { blockNumber: '101', timestamp: '1700000600' }, // newest
        { blockNumber: '102', timestamp: '1700000060' }, // middle
      ],
      positions: [],
      sigilValidations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Newest first: block 101 should lead.
    expect(json.activities[0].id).toBe('margin-101');
    expect(json.activities[1].id).toBe('margin-102');
    expect(json.activities[2].id).toBe('margin-100');
  });

  it('interleaves margin/position/sigil events in unified unix order', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [{ blockNumber: '100', timestamp: '1700000100' }],
      positions: [{ id: 'p1', venueId: 1, openedAtBlock: '101', openedAtTimestamp: '1700000300' }],
      sigilValidations: [
        {
          intentHash: '0xabc',
          agent: '0x' + '1'.repeat(40),
          timestamp: '1700000200',
          txHash: '0xdef',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // 1700000300 (position) > 1700000200 (sigil) > 1700000100 (margin).
    expect(json.activities[0].id).toBe('pos-p1');
    expect(json.activities[1].id).toBe('sigil-0xabc');
    expect(json.activities[2].id).toBe('margin-100');
  });
});

describe('GET /api/portfolio/activity — KK-9 corrupt-timestamp drop', () => {
  it('drops marginUpdates with empty timestamp', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [
        { blockNumber: '100', timestamp: '1700000000' },
        { blockNumber: '101', timestamp: '' },
        { blockNumber: '102', timestamp: '1700000200' },
      ],
      positions: [],
      sigilValidations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activities).toHaveLength(2);
    // Make sure the blank-timestamp row didn't slip through.
    expect(json.activities.find((a: any) => a.id === 'margin-101')).toBeUndefined();
  });

  it('drops positions with non-numeric timestamp', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [],
      positions: [
        { id: 'p1', venueId: 1, openedAtBlock: '100', openedAtTimestamp: 'NaN' },
        { id: 'p2', venueId: 2, openedAtBlock: '101', openedAtTimestamp: '1700000000' },
      ],
      sigilValidations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activities).toHaveLength(1);
    expect(json.activities[0].id).toBe('pos-p2');
  });

  it('drops sigilValidations with negative or implausible timestamp', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [],
      positions: [],
      sigilValidations: [
        {
          intentHash: '0xa',
          agent: '0x' + '1'.repeat(40),
          timestamp: '-1',
          txHash: '0xt1',
        },
        {
          intentHash: '0xb',
          agent: '0x' + '2'.repeat(40),
          timestamp: '999999999999', // year 33000+
          txHash: '0xt2',
        },
        {
          intentHash: '0xc',
          agent: '0x' + '3'.repeat(40),
          timestamp: '1700000000',
          txHash: '0xt3',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activities).toHaveLength(1);
    expect(json.activities[0].id).toBe('sigil-0xc');
  });
});

describe('GET /api/portfolio/activity — KK-10 null-agent drop', () => {
  it('drops sigilValidations where agent is null', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [],
      positions: [],
      sigilValidations: [
        {
          intentHash: '0xnullagent',
          agent: null,
          timestamp: '1700000000',
          txHash: '0xt1',
        },
        {
          intentHash: '0xokagent',
          agent: '0x' + '1'.repeat(40),
          timestamp: '1700000100',
          txHash: '0xt2',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Pre-KK-10: route crashed on `.slice(0, 8)` of null → entire feed
    // returned 500 → UI showed empty + "pending". Post-fix: drop the
    // null-agent row, keep the rest.
    expect(json.activities).toHaveLength(1);
    expect(json.activities[0].id).toBe('sigil-0xokagent');
  });
});

describe('GET /api/portfolio/activity — output shape', () => {
  it('strips tsUnix from the wire response', async () => {
    (gql as any).mockResolvedValue({
      marginUpdates: [{ blockNumber: '100', timestamp: '1700000000' }],
      positions: [],
      sigilValidations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // tsUnix is the internal sort key. It MUST be stripped from the
    // wire response — otherwise a client could infer "true" timestamps
    // bypassing the human-readable display contract.
    expect(json.activities[0]).not.toHaveProperty('tsUnix');
    expect(json.activities[0]).toHaveProperty('timestamp');
    expect(typeof json.activities[0].timestamp).toBe('string');
  });

  it('caps the feed at 12 items', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      blockNumber: String(100 + i),
      timestamp: String(1700000000 + i),
    }));
    (gql as any).mockResolvedValue({
      marginUpdates: many,
      positions: [],
      sigilValidations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activities).toHaveLength(12);
  });

  it('truncates agent address to first 8 chars + ellipsis', async () => {
    const longAgent = '0xabcdefabcdef1234567890abcdef1234567890ab';
    (gql as any).mockResolvedValue({
      marginUpdates: [],
      positions: [],
      sigilValidations: [
        {
          intentHash: '0xa',
          agent: longAgent,
          timestamp: '1700000000',
          txHash: '0xt',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.activities[0].meta).toBe('Agent 0xabcdef…');
  });
});

describe('GET /api/portfolio/activity — pending paths', () => {
  it('returns pending when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.activities).toEqual([]);
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.activities).toEqual([]);
  });
});
