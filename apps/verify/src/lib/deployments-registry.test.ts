import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs/promises BEFORE importing the helper.
vi.mock('node:fs/promises', () => ({
  default: { readFile: vi.fn() },
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import { loadDeploymentRegistry, loadContractAddress, listLiveContracts } from './deployments-registry';

/**
 * Pins the centralized deployments-registry helpers, replaces 5+ copy-pasted
 * path-walk blocks across routes. If a future refactor breaks the candidate-
 * path order, the zero-address sentinel handling, or the hex validation,
 * CI catches it before review.
 *
 * Audit P-1 path-walk invariant + the zero-address-as-not-live convention.
 */

const originalEnv = process.env.ATRIUM_DEPLOYMENTS_PATH;
const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const REAL_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ATRIUM_DEPLOYMENTS_PATH;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.ATRIUM_DEPLOYMENTS_PATH;
  else process.env.ATRIUM_DEPLOYMENTS_PATH = originalEnv;
  vi.restoreAllMocks();
});

describe('loadDeploymentRegistry()', () => {
  it('returns null when no candidate path resolves', async () => {
    (readFile as any).mockRejectedValue(new Error('ENOENT'));
    expect(await loadDeploymentRegistry()).toBeNull();
  });

  it('returns parsed JSON when a candidate path resolves', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: REAL_ADDRESS } } }),
    );
    const reg = await loadDeploymentRegistry();
    expect(reg).toEqual({ contracts: { coffer: { address: REAL_ADDRESS } } });
  });

  it('walks candidate paths in order until one resolves', async () => {
    // Audit P-1: env override is tried first, then ../../ (verify app
    // running from apps/verify/), then ../, then cwd.
    (readFile as any)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(JSON.stringify({ contracts: { plinth: { address: REAL_ADDRESS } } }));

    await loadDeploymentRegistry();
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it('honors the ATRIUM_DEPLOYMENTS_PATH env override as first candidate', async () => {
    process.env.ATRIUM_DEPLOYMENTS_PATH = '/custom/path/registry.json';
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { plinth: { address: REAL_ADDRESS } } }),
    );

    await loadDeploymentRegistry();
    // First call should target the env path.
    expect((readFile as any).mock.calls[0][0]).toBe('/custom/path/registry.json');
  });

  it('returns null on malformed JSON', async () => {
    (readFile as any).mockResolvedValueOnce('not-json-at-all');
    expect(await loadDeploymentRegistry()).toBeNull();
  });

  it('returns null on empty file', async () => {
    (readFile as any).mockResolvedValueOnce('');
    expect(await loadDeploymentRegistry()).toBeNull();
  });
});

describe('loadContractAddress()', () => {
  it('returns the address when slug + valid hex are present', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: REAL_ADDRESS } } }),
    );
    expect(await loadContractAddress('coffer')).toBe(REAL_ADDRESS);
  });

  it('returns null when slug is missing', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { plinth: { address: REAL_ADDRESS } } }),
    );
    expect(await loadContractAddress('coffer')).toBeNull();
  });

  it('returns null when address is the zero-address sentinel', async () => {
    // Deployment scripts may write 0x000...0 as a placeholder pre-deploy.
    // The landing-page green dot must NOT light up for placeholder records.
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: ZERO_ADDRESS } } }),
    );
    expect(await loadContractAddress('coffer')).toBeNull();
  });

  it('returns null when address is malformed (not 0x + 40 hex)', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: '0xnotvalid' } } }),
    );
    expect(await loadContractAddress('coffer')).toBeNull();
  });

  it('accepts both lowercase and checksummed addresses', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: REAL_ADDRESS.toLowerCase() } } }),
    );
    expect(await loadContractAddress('coffer')).toBe(REAL_ADDRESS.toLowerCase());
  });

  it('returns null when contracts section is absent', async () => {
    (readFile as any).mockResolvedValueOnce(JSON.stringify({ network: 'arbitrum-sepolia' }));
    expect(await loadContractAddress('coffer')).toBeNull();
  });
});

describe('listLiveContracts()', () => {
  it('lists every contract with a real (non-zero, valid hex) address', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({
        contracts: {
          coffer: { address: REAL_ADDRESS },
          plinth: { address: ZERO_ADDRESS }, // sentinel, excluded
          sigil: { address: REAL_ADDRESS.toLowerCase() },
          vigil: { address: 'malformed' }, // invalid, excluded
          rostrum: {}, // missing address, excluded
        },
      }),
    );
    const live = await listLiveContracts();
    const slugs = live.map((c) => c.slug).sort();
    expect(slugs).toEqual(['coffer', 'sigil']);
  });

  it('excludes superseded/mock/placeholder/deprecated slugs even with real addresses', async () => {
    // A judge using the /venues Try-it (its mirror reads this list) or the
    // landing "live" dots must not see deprecated, mock, placeholder,
    // legacy-version, or verification-source duplicates counted as live.
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({
        contracts: {
          coffer: { address: REAL_ADDRESS },
          'faucet-deprecated-v1': { address: REAL_ADDRESS },
          'mock-aave-pool': { address: REAL_ADDRESS },
          'adapter-aave-horizon-v1.1-pool-placeholder': { address: REAL_ADDRESS },
          'lantern-attestor-v1-pre-event-extension': { address: REAL_ADDRESS },
          'atrium-router-v2-current-source': { address: REAL_ADDRESS },
          plinth: { address: REAL_ADDRESS },
        },
      }),
    );
    const slugs = (await listLiveContracts()).map((c) => c.slug).sort();
    expect(slugs).toEqual(['coffer', 'plinth']);
  });

  it('returns empty array when registry is unreadable', async () => {
    (readFile as any).mockRejectedValue(new Error('ENOENT'));
    expect(await listLiveContracts()).toEqual([]);
  });

  it('returns empty array when contracts section is empty {}', async () => {
    (readFile as any).mockResolvedValueOnce(JSON.stringify({ contracts: {} }));
    expect(await listLiveContracts()).toEqual([]);
  });

  it('returns empty array when EVERY recorded contract is the zero sentinel', async () => {
    // Critical case: fresh deployment script writes placeholders for all
    // contracts. Landing page must show zero live, not all live.
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({
        contracts: {
          coffer: { address: ZERO_ADDRESS },
          plinth: { address: ZERO_ADDRESS },
          sigil: { address: ZERO_ADDRESS },
        },
      }),
    );
    expect(await listLiveContracts()).toEqual([]);
  });

  it('preserves the address in the returned record', async () => {
    (readFile as any).mockResolvedValueOnce(
      JSON.stringify({ contracts: { coffer: { address: REAL_ADDRESS } } }),
    );
    const live = await listLiveContracts();
    expect(live[0]).toEqual({ slug: 'coffer', address: REAL_ADDRESS });
  });
});
