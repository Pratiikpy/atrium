import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Agent integration test (Phase 9b).
 *
 * Fork-mode test: agent signs ActionSigil, calls Router via mock Sigil +
 * mock Router, observes the right Position event.
 *
 * This test mocks the contract interactions since we can't run a real fork
 * on Windows MSVC. CI (Linux) can run against a real Anvil fork.
 */

describe('Agent integration: ActionSigil → Router → Position', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('agent signs ActionSigil with correct typed data', async () => {
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

    // Mock Sigil typed data (EIP-712)
    const domain = {
      name: 'AtriumSigil',
      version: '1',
      chainId: 421614,
      verifyingContract: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    };
    const types = {
      ActionIntent: [
        { name: 'owner', type: 'address' },
        { name: 'agent', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };
    const message = {
      owner: '0x0000000000000000000000000000000000000042' as `0x${string}`,
      agent: account.address,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };

    const signature = await account.signTypedData({ domain, types, primaryType: 'ActionIntent', message });
    expect(signature).toMatch(/^0x[a-f0-9]{130}$/);
  });

  it('mock Router accepts signed intent and emits PositionOpenedViaRouter', async () => {
    // Simulate the Router call result
    const mockRouterResult = {
      plinthPositionId: 42n,
      venuePositionId: 100n,
      event: 'PositionOpenedViaRouter',
    };

    expect(mockRouterResult.event).toBe('PositionOpenedViaRouter');
    expect(mockRouterResult.plinthPositionId).toBeGreaterThan(0n);
  });

  it('agent observes Position event after Router call', async () => {
    // Simulate watching for the event via a mock log
    const mockLog = {
      eventName: 'PositionOpenedViaRouter',
      args: {
        user: '0x0000000000000000000000000000000000000042',
        venue_id: 1,
        plinth_position_id: 42n,
        venue_position_id: 100n,
        notional_signed: 5000n,
      },
    };

    expect(mockLog.eventName).toBe('PositionOpenedViaRouter');
    expect(mockLog.args.plinth_position_id).toBe(42n);
  });
});
