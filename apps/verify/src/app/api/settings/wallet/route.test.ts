import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: vi.fn(),
}));

import { loadContractAddress } from '@/lib/deployments-registry';

/**
 * Iter 67 audit fix: locks the NN-2 honesty fix on
 * /api/settings/wallet. Zero tests pinned it pre-iter-67.
 *
 * - NN-2: pre-fix the route unconditionally returned
 *   `authenticator: 'ATRIUM · Yubikey 5C · Touch ID'` whenever a
 *   DEMO_WALLET_ADDRESS was set. This advertised real hardware-
 *   authenticator state that didn't exist (Postern undeployed).
 *   Real-data discipline violation per docs/conventions/ui.md.
 *
 *   Now: `source: 'postern'` only when PosternKeyRegistry is in the
 *   deployments registry. Until then `source: 'pending'` with every
 *   sensitive field null.
 *
 * Three branches:
 *   - No wallet → address:"-", all nulls, pending.
 *   - Wallet but no Postern deployment → address+ens, all other nulls, pending.
 *   - Wallet + Postern deployed → fully-populated metadata, source:postern.
 */

const ORIGINAL_WALLET = process.env.DEMO_WALLET_ADDRESS;
const ORIGINAL_ENS = process.env.DEMO_WALLET_ENS;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete process.env.DEMO_WALLET_ADDRESS;
  delete process.env.DEMO_WALLET_ENS;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_WALLET == null) delete process.env.DEMO_WALLET_ADDRESS;
  else process.env.DEMO_WALLET_ADDRESS = ORIGINAL_WALLET;
  if (ORIGINAL_ENS == null) delete process.env.DEMO_WALLET_ENS;
  else process.env.DEMO_WALLET_ENS = ORIGINAL_ENS;
});

describe('GET /api/settings/wallet, no wallet branch', () => {
  it('returns address:"-" + every-field-null + source:pending', async () => {
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.address).toBe('-');
    expect(json.ens).toBeNull();
    expect(json.authenticator).toBeNull();
    expect(json.bundler).toBeNull();
    expect(json.paymaster).toBeNull();
    expect(json.erc4337Ready).toBe(false);
    expect(json.erc7702Ready).toBe(false);
    expect(json.source).toBe('pending');
  });

  it('does NOT call deployments-registry when wallet env unset', async () => {
    const { GET } = await import('./route');
    await GET();
    expect(loadContractAddress).not.toHaveBeenCalled();
  });
});

describe('GET /api/settings/wallet, wallet set, Postern NOT deployed (NN-2)', () => {
  it('returns wallet+ens but every Postern-derived field null', async () => {
    const wallet = '0x' + 'a'.repeat(40);
    process.env.DEMO_WALLET_ADDRESS = wallet;
    process.env.DEMO_WALLET_ENS = 'jamie.eth';
    (loadContractAddress as any).mockResolvedValue(null);

    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.address).toBe(wallet);
    expect(json.ens).toBe('jamie.eth');
    // The load-bearing NN-2 assertion: NONE of the hardware-
    // authenticator strings should leak through when Postern is
    // undeployed.
    expect(json.authenticator).toBeNull();
    expect(json.bundler).toBeNull();
    expect(json.paymaster).toBeNull();
    expect(json.erc4337Ready).toBe(false);
    expect(json.erc7702Ready).toBe(false);
    expect(json.source).toBe('pending');
  });

  it('returns ens:null when DEMO_WALLET_ENS env unset', async () => {
    process.env.DEMO_WALLET_ADDRESS = '0x' + 'b'.repeat(40);
    (loadContractAddress as any).mockResolvedValue(null);
    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.ens).toBeNull();
  });
});

describe('GET /api/settings/wallet, Postern deployed branch', () => {
  it('reports honest wallet state (no fabricated Pimlico/4337) when registry is deployed', async () => {
    const wallet = '0x' + 'c'.repeat(40);
    process.env.DEMO_WALLET_ADDRESS = wallet;
    (loadContractAddress as any).mockResolvedValue('0x' + '1'.repeat(40));

    const { GET } = await import('./route');
    const json = await (await GET()).json();
    expect(json.address).toBe(wallet);
    // The app's only connector is the Coinbase Smart Wallet (lib/wagmi.ts).
    expect(json.authenticator).toBe('Coinbase Smart Wallet · passkey');
    // 063-FE8: no Pimlico bundler/paymaster exists; AA is NOT ready.
    expect(json.bundler).toBeNull();
    expect(json.paymaster).toBeNull();
    expect(json.erc4337Ready).toBe(false);
    expect(json.erc7702Ready).toBe(false);
    // What IS real: the on-chain session-key registry address.
    expect(json.sessionKeyRegistry).toBe('0x' + '1'.repeat(40));
    expect(json.source).toBe('postern');
    // Anti-regression: the fabricated Pimlico/bundler strings must never leak.
    expect(JSON.stringify(json)).not.toMatch(/Pimlico/i);
  });

  it('queries postern-key-registry slug from deployments registry', async () => {
    process.env.DEMO_WALLET_ADDRESS = '0x' + 'd'.repeat(40);
    (loadContractAddress as any).mockResolvedValue('0x' + '2'.repeat(40));
    const { GET } = await import('./route');
    await GET();
    expect(loadContractAddress).toHaveBeenCalledWith('postern-key-registry');
  });
});
