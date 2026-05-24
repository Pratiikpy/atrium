import { Hono } from 'hono';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { safeErrorDetail } from '../lib/error-safe';

type VenuesBindings = {
  ARBITRUM_SEPOLIA_RPC: string;
  ENV?: string;
  // Per-venue adapter addresses, optional. When unset the venue renders as
  // `not_deployed` honestly (no fake-operational signal). When set, the
  // route reads `get_venue_health()` from the live adapter contract.
  ADAPTER_HYPERLIQUID?: string;
  ADAPTER_AAVE_HORIZON?: string;
  ADAPTER_PENDLE?: string;
  ADAPTER_TRADE_XYZ?: string;
  ADAPTER_CURVE?: string;
  ADAPTER_POLYMARKET?: string;
};

export const venuesRouter = new Hono<{ Bindings: VenuesBindings }>();

// Bound venue addresses to a strict 40-hex shape. An operator misconfig
// (e.g. paste with whitespace) would otherwise throw inside viem with a
// cryptic message; surface it as `bad_address_config` so ops sees the
// problem.
const ADDR_REGEX = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDR = '0x' + '0'.repeat(40);

function resolveVenue(name: string, raw: string | undefined): { live: boolean; adapter: string; reason?: string } {
  if (!raw) return { live: false, adapter: ZERO_ADDR, reason: 'not_deployed' };
  if (!ADDR_REGEX.test(raw)) {
    console.warn(`[venues] ${name} env var malformed: ${raw.slice(0, 8)}…`);
    return { live: false, adapter: ZERO_ADDR, reason: 'bad_address_config' };
  }
  return { live: true, adapter: raw };
}

const HEALTH_ABI = [
  {
    type: 'function',
    name: 'get_venue_health',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'is_operational', type: 'bool' },
          { name: 'last_heartbeat_block', type: 'uint64' },
          { name: 'quoted_spread_bps', type: 'uint16' },
          { name: 'status_message', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

venuesRouter.get('/health', async (c) => {
  // Build the venue list at request time from c.env so changes to adapter
  // env vars take effect without a redeploy.
  const venues = [
    { id: 1, name: 'Hyperliquid HIP-3', ...resolveVenue('ADAPTER_HYPERLIQUID', c.env.ADAPTER_HYPERLIQUID) },
    { id: 2, name: 'Aave Horizon', ...resolveVenue('ADAPTER_AAVE_HORIZON', c.env.ADAPTER_AAVE_HORIZON) },
    { id: 3, name: 'Pendle V2', ...resolveVenue('ADAPTER_PENDLE', c.env.ADAPTER_PENDLE) },
    { id: 4, name: 'Trade.xyz', ...resolveVenue('ADAPTER_TRADE_XYZ', c.env.ADAPTER_TRADE_XYZ) },
    { id: 5, name: 'Curve', ...resolveVenue('ADAPTER_CURVE', c.env.ADAPTER_CURVE) },
    { id: 6, name: 'Polymarket (via Aqueduct)', ...resolveVenue('ADAPTER_POLYMARKET', c.env.ADAPTER_POLYMARKET) },
  ];

  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(c.env.ARBITRUM_SEPOLIA_RPC),
  });
  const results = await Promise.all(
    venues.map(async (v) => {
      if (!v.live) {
        return { id: v.id, name: v.name, adapter: v.adapter, health: { is_operational: false, status_message: v.reason ?? 'not_deployed' } };
      }
      try {
        // Audit U-31: viem 2.48 readContract param type requires
        // `authorizationList` (EIP-7702) at the type level even though
        // it's optional at runtime. `as never` silences the strict
        // check without weakening the inferred return type.
        const health = await client.readContract({
          address: v.adapter as `0x${string}`,
          abi: HEALTH_ABI,
          functionName: 'get_venue_health',
        } as never);
        return { id: v.id, name: v.name, adapter: v.adapter, health };
      } catch (err) {
        return { id: v.id, name: v.name, adapter: v.adapter, health: { is_operational: false, status_message: safeErrorDetail(err, c.env) } };
      }
    })
  );
  return c.json({ venues: results, retrievedAt: new Date().toISOString() });
});
