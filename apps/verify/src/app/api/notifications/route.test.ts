import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';

/**
 * Iter 66 audit fix: locks the S-6 + II-1 + T-6/U-7 fixes on
 * /api/notifications. Zero tests pinned them pre-iter-66.
 *
 * - S-6: sort by numeric tsUnix, not by the human "Xm ago" lexical
 *   string. Same canonical fix as KK-8 in portfolio/activity.
 * - II-1: parseTsOrNull drops rows with NaN/empty/negative/year-9999+
 *   timestamps so `ago(NaN)` never renders "NaN s ago" and the
 *   sort comparator never gets a NaN tsUnix that breaks ordering.
 * - T-6 / U-7: tsUnix is the internal sort key and MUST be stripped
 *   from the wire response. Otherwise clients can read the raw
 *   unix sec value the route deliberately abstracted behind ago().
 *
 * The inbox aggregates two Scribe entities: liquidationEvents
 * (severity:danger) + sigilRevocations (severity:warning).
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

describe('GET /api/notifications, S-6 unix sort', () => {
  it('sorts inbox by numeric tsUnix desc, not by lexical ago() string', async () => {
    // Pre-S-6: sort would compare "10m ago" < "2m ago" alphabetically,
    // putting older items above newer ones whenever the ago-unit count
    // crossed a digit boundary. Post-fix: numeric tsUnix subtract.
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '1700000000', txHash: '0xt1' }, // oldest
        { id: 'L2', user: TEST_WALLET, timestamp: '1700000600', txHash: '0xt2' }, // newest
        { id: 'L3', user: TEST_WALLET, timestamp: '1700000060', txHash: '0xt3' }, // middle
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications[0].id).toBe('liq-L2');
    expect(json.notifications[1].id).toBe('liq-L3');
    expect(json.notifications[2].id).toBe('liq-L1');
  });

  it('interleaves liquidations + sigil revocations by unix order', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '1700000200', txHash: '0xt1' },
      ],
      sigilRevocations: [
        {
          id: 'R1',
          owner: TEST_WALLET,
          agent: '0x' + '1'.repeat(40),
          intentHash: '0x' + 'a'.repeat(64),
          timestamp: '1700000100',
          txHash: '0xrev',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // 1700000200 (liq) > 1700000100 (rev).
    expect(json.notifications[0].id).toBe('liq-L1');
    expect(json.notifications[1].id).toBe('rev-R1');
  });
});

describe('GET /api/notifications, II-1 bad-timestamp drop', () => {
  it('drops liquidations with NaN timestamp', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '1700000000', txHash: '0xt1' },
        { id: 'L2', user: TEST_WALLET, timestamp: 'NaN', txHash: '0xt2' },
        { id: 'L3', user: TEST_WALLET, timestamp: '1700000100', txHash: '0xt3' },
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications).toHaveLength(2);
    expect(json.notifications.find((n: any) => n.id === 'liq-L2')).toBeUndefined();
  });

  it('drops sigil revocations with empty timestamp', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [],
      sigilRevocations: [
        {
          id: 'R1',
          owner: TEST_WALLET,
          agent: '0x' + '1'.repeat(40),
          intentHash: '0x' + 'a'.repeat(64),
          timestamp: '',
          txHash: '0xrev1',
        },
        {
          id: 'R2',
          owner: TEST_WALLET,
          agent: '0x' + '2'.repeat(40),
          intentHash: '0x' + 'b'.repeat(64),
          timestamp: '1700000000',
          txHash: '0xrev2',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].id).toBe('rev-R2');
  });

  it('drops rows with negative timestamp', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '-1', txHash: '0xt1' },
        { id: 'L2', user: TEST_WALLET, timestamp: '1700000000', txHash: '0xt2' },
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].id).toBe('liq-L2');
  });
});

describe('GET /api/notifications, T-6/U-7 wire safety', () => {
  it('strips tsUnix from wire response', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '1700000000', txHash: '0xt1' },
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // T-6: clients must not be able to read the raw unix sec value.
    expect(json.notifications[0]).not.toHaveProperty('tsUnix');
    // But the human-readable "X ago" timestamp must still be present.
    expect(json.notifications[0]).toHaveProperty('timestamp');
    expect(typeof json.notifications[0].timestamp).toBe('string');
  });

  it('caps the inbox at 50 items', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `L${i}`,
      user: TEST_WALLET,
      timestamp: String(1700000000 + i),
      txHash: `0x${i.toString(16).padStart(64, '0')}`,
    }));
    (gql as any).mockResolvedValue({
      liquidationEvents: many,
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications).toHaveLength(50);
  });
});

describe('GET /api/notifications, severity + meta semantics', () => {
  it('marks liquidations as severity:danger', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [
        { id: 'L1', user: TEST_WALLET, timestamp: '1700000000', txHash: '0xt1' },
      ],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications[0].severity).toBe('danger');
    expect(json.notifications[0].title).toBe('Liquidation triggered');
  });

  it('marks sigil revocations as severity:warning + truncates agent/intent', async () => {
    const agent = '0xabcdefab' + 'f'.repeat(32);
    const intent = '0xdeadbeef' + 'a'.repeat(56);
    (gql as any).mockResolvedValue({
      liquidationEvents: [],
      sigilRevocations: [
        {
          id: 'R1',
          owner: TEST_WALLET,
          agent,
          intentHash: intent,
          timestamp: '1700000000',
          txHash: '0xrev',
        },
      ],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.notifications[0].severity).toBe('warning');
    // Agent slice(0,8) = "0xabcdef" (8 chars including 0x prefix).
    expect(json.notifications[0].title).toBe('Mandate revoked · 0xabcdef…');
    // intentHash slice(0,14) = "0xdeadbeefaaaa" (14 chars).
    expect(json.notifications[0].meta).toBe('intent 0xdeadbeefaaaa… revoked');
  });
});

describe('GET /api/notifications, pending paths', () => {
  it('returns pending when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.notifications).toEqual([]);
  });

  it('returns pending on gql failure', async () => {
    (gql as any).mockRejectedValue(new Error('Scribe outage'));
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.notifications).toEqual([]);
  });

  it('returns source:scribe on success', async () => {
    (gql as any).mockResolvedValue({
      liquidationEvents: [],
      sigilRevocations: [],
    });
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('scribe');
  });
});
