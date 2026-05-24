import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scribe-helpers', () => ({
  gql: vi.fn(),
}));

import { gql } from '@/lib/scribe-helpers';
import { GET } from './route';

/**
 * Locks the active-mandate-set computation: validations MINUS revocations,
 * keyed by intentHash. Pre-existing summary route uses the same pattern
 * for the aggregate count; this route returns the actual rows.
 *
 * Honesty invariants:
 *   - No wallet env → empty list + source: 'pending' + reason
 *   - Scribe outage → empty list + source: 'pending' + reason
 *   - Healthy → only validations whose intentHash hasn't been revoked
 */

const originalWallet = process.env.DEMO_WALLET_ADDRESS;
const WALLET = '0x' + 'a'.repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEMO_WALLET_ADDRESS = WALLET;
});

afterEach(() => {
  if (originalWallet === undefined) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = originalWallet;
  vi.restoreAllMocks();
});

describe('GET /api/agents/my-mandates — pending paths', () => {
  it('returns source:pending + no_wallet_configured when wallet env unset', async () => {
    delete process.env.DEMO_WALLET_ADDRESS;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mandates).toEqual([]);
    expect(body.source).toBe('pending');
    expect(body.reason).toBe('no_wallet_configured');
  });

  it('returns source:pending + scribe_unavailable when gql throws', async () => {
    (gql as any).mockRejectedValueOnce(new Error('Scribe 503'));
    const res = await GET();
    const body = await res.json();
    expect(body.mandates).toEqual([]);
    expect(body.source).toBe('pending');
    expect(body.reason).toBe('scribe_unavailable');
  });
});

describe('GET /api/agents/my-mandates — mandate computation', () => {
  it('returns active mandates from Scribe when no revocations', async () => {
    (gql as any).mockResolvedValueOnce({
      sigilValidations: [
        {
          id: '1',
          agent: '0xagent1',
          intentHash: '0xhash1',
          blockNumber: '100',
          timestamp: '1700000000',
          txHash: '0xtx1',
        },
        {
          id: '2',
          agent: '0xagent2',
          intentHash: '0xhash2',
          blockNumber: '101',
          timestamp: '1700000100',
          txHash: '0xtx2',
        },
      ],
      sigilRevocations: [],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.mandates).toHaveLength(2);
    expect(body.source).toBe('scribe');
    expect(body.mandates[0]).toEqual({
      intentHash: '0xhash1',
      agent: '0xagent1',
      issuedAtTimestamp: 1700000000,
      txHash: '0xtx1',
    });
  });

  it('drops validations whose intentHash has been revoked', async () => {
    (gql as any).mockResolvedValueOnce({
      sigilValidations: [
        { id: '1', agent: '0xa1', intentHash: '0xhash1', blockNumber: '100', timestamp: '1700000000', txHash: '0xtx1' },
        { id: '2', agent: '0xa2', intentHash: '0xhash2', blockNumber: '101', timestamp: '1700000100', txHash: '0xtx2' },
        { id: '3', agent: '0xa3', intentHash: '0xhash3', blockNumber: '102', timestamp: '1700000200', txHash: '0xtx3' },
      ],
      sigilRevocations: [
        { agent: '0xa2', intentHash: '0xhash2', timestamp: '1700000150' },
      ],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.mandates.map((m: any) => m.intentHash)).toEqual(['0xhash1', '0xhash3']);
  });

  it('drops rows with malformed timestamps rather than rendering NaN', async () => {
    // Audit pattern matching KK-3: defensive against bad Scribe rows.
    (gql as any).mockResolvedValueOnce({
      sigilValidations: [
        { id: '1', agent: '0xa1', intentHash: '0xhash1', blockNumber: '100', timestamp: 'not-a-number', txHash: '0xtx1' },
        { id: '2', agent: '0xa2', intentHash: '0xhash2', blockNumber: '101', timestamp: '1700000100', txHash: '0xtx2' },
      ],
      sigilRevocations: [],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.mandates).toHaveLength(1);
    expect(body.mandates[0].intentHash).toBe('0xhash2');
  });

  it('handles empty Scribe response', async () => {
    (gql as any).mockResolvedValueOnce({
      sigilValidations: [],
      sigilRevocations: [],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.mandates).toEqual([]);
    expect(body.source).toBe('scribe');
  });

  it('queries Scribe with the connected wallet as owner (lowercase)', async () => {
    process.env.DEMO_WALLET_ADDRESS = '0xAaBbCcDdEeFf' + '0'.repeat(28);
    (gql as any).mockResolvedValueOnce({ sigilValidations: [], sigilRevocations: [] });
    await GET();
    const callArgs = (gql as any).mock.calls[0];
    expect(callArgs[1]).toEqual({ owner: '0xaabbccddeeff' + '0'.repeat(28) });
  });
});
