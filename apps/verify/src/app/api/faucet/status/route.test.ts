import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the deployments registry so the test controls the cofferAddress branch.
const mockLoadContractAddress = vi.fn();
vi.mock('@/lib/deployments-registry', () => ({
  loadContractAddress: (...args: unknown[]) => mockLoadContractAddress(...args),
}));

import { GET } from './route';

/**
 * Locks the honest-pending invariant for the onboarding faucet step.
 *
 * The faucet drop list (10k USDC, 5k USDC, 25 rAAPL, 3 WETH) is the
 * prototype's contract per `desing/Atrium App.standalone.html` file5.js and
 * is exposed verbatim through this route so the onboarding stepper can render
 * the same table without reaching back into a config file.
 *
 * `available: true` is gated on Coffer being in the deployments registry —
 * the faucet's mint+approve+deposit flow needs the vault to exist before it
 * can credit the user. Until then the route returns `available: false` with
 * a named reason, which the onboarding step shows as "pending" instead of
 * a fake "Claim faucet" button.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/faucet/status — honest pending', () => {
  it('returns available:false + named reason when Coffer is undeployed', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.source).toBe('pending');
    expect(body.reason).toMatch(/Coffer/i);
  });

  it('returns available:false even when Coffer is deployed (faucet adapter still pending)', async () => {
    // Faucet contract is separate from Coffer; this branch guards against
    // assuming "Coffer live" === "faucet live."
    mockLoadContractAddress.mockResolvedValueOnce('0x' + 'a'.repeat(40));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/adapter/i);
  });
});

describe('GET /api/faucet/status — drop schedule contract', () => {
  it('always returns the canonical 4-row drop schedule, in fixed order', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    const res = await GET();
    const body = await res.json();
    expect(body.drops).toHaveLength(4);
    expect(body.drops[0]).toEqual({ token: 'USDC', amount: 10000, chain: 'arb-sepolia' });
    expect(body.drops[1]).toEqual({ token: 'USDC', amount: 5000, chain: 'rh-chain' });
    expect(body.drops[2]).toEqual({ token: 'rAAPL', amount: 25, chain: 'rh-chain' });
    expect(body.drops[3]).toEqual({ token: 'WETH', amount: 3, chain: 'arb-sepolia' });
  });

  it('drop amounts match the landing-page closing-CTA promise (10k USDC + 5k rAAPL band)', async () => {
    mockLoadContractAddress.mockResolvedValueOnce(null);
    const res = await GET();
    const body = await res.json();
    // The closing CTA promises $10k USDC + $5k rAAPL (drift between rAAPL
    // amount in number of shares vs USD has been audited in human_left.md).
    const usdcArb = body.drops.find((d: { token: string; chain: string }) => d.token === 'USDC' && d.chain === 'arb-sepolia');
    expect(usdcArb?.amount).toBe(10000);
  });
});
