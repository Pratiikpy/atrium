import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/deployments-registry', () => ({
  listLiveContracts: vi.fn(),
}));

import { listLiveContracts } from '@/lib/deployments-registry';

/**
 * Iter 70 audit fix: thin wrapper around lib/deployments-registry's
 * listLiveContracts(). The route's contract:
 *   - empty result → source:pending + live:[]
 *   - non-empty → source:deployments + live=array of slugs
 *
 * The landing page Subsystems section binds to `live` to render the
 * green dot for each deployed subsystem. The pending state must
 * surface so unset/zero-address contracts don't render as "live."
 */

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/protocol/subsystems, empty / pending', () => {
  it('returns source:pending + live:[] when no contracts deployed', async () => {
    (listLiveContracts as any).mockResolvedValue([]);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('pending');
    expect(json.live).toEqual([]);
  });
});

describe('GET /api/protocol/subsystems, populated', () => {
  it('maps live contracts to their slug list', async () => {
    (listLiveContracts as any).mockResolvedValue([
      { slug: 'coffer', address: '0x' + '1'.repeat(40) },
      { slug: 'plinth', address: '0x' + '2'.repeat(40) },
      { slug: 'aqueduct', address: '0x' + '3'.repeat(40) },
    ]);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.source).toBe('deployments');
    expect(json.live).toEqual(['coffer', 'plinth', 'aqueduct']);
  });

  it('preserves insertion order from listLiveContracts', async () => {
    (listLiveContracts as any).mockResolvedValue([
      { slug: 'aqueduct', address: '0x' + 'a'.repeat(40) },
      { slug: 'coffer', address: '0x' + 'b'.repeat(40) },
    ]);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    // Order is the load-bearing semantic, landing page renders the
    // subsystem tiles in the order returned. Sort upstream if needed,
    // not here.
    expect(json.live[0]).toBe('aqueduct');
    expect(json.live[1]).toBe('coffer');
  });
});
