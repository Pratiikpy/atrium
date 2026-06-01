import { NextResponse } from 'next/server';
import { loadContractAddress } from '@/lib/deployments-registry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deployments/address?slug=coffer
 *
 * Public deploy-address lookup. Components that need a contract address
 * for `useWriteContract` reads call this. Returns `{ address: null }`
 * when the contract isn't deployed (zero-address sentinel or missing
 * registry entry), clients should not attempt to write in that case.
 *
 * Slug enum is closed so a caller can't probe arbitrary keys from the
 * registry JSON via this endpoint.
 */
const ALLOWED_SLUGS = new Set([
  'coffer',
  'plinth',
  'sigil',
  'vigil',
  'aqueduct',
  'praetor-timelock',
  'portico-registry',
  // 114-PM3 fix (2026-05-30): the Trade "Open position" + "Close" hooks
  // (use-open-position.ts:115, use-close-position.ts:97) resolve the
  // router via slug=atrium-router. It was absent from this allowlist so
  // the route returned 400 and BOTH trade money paths threw `address_400`
  // before reaching the wallet. The router IS deployed (registry key
  // 'atrium-router'), so this was an allowlist gap, not a missing deploy.
  'atrium-router',
  'rostrum',
  'lantern-attestor',
  // Audit U-18: added for the Kill Switch (Verifier step 7) wiring.
  // PosternKillSwitch.activate() is the single button that revokes every
  // Sigil mandate + cancels every Postern session key in one tx.
  'postern-kill-switch',
  'postern-key-registry',
  // Audit U-20 + U-28: per-adapter Portico slugs for the Trade button
  // wiring. Slug values match `Venue.adapterSlug` (NOT venue id) so
  // venues that share a contract, Hyperliquid HIP-3 and HIP-4 both
  // route through `adapter-hyperliquid`, resolve to the same address.
  // The deploy script writes one contract per unique adapter slug.
  'adapter-hyperliquid',
  'adapter-aave-horizon',
  'adapter-pendle',
  'adapter-curve',
  'adapter-trade-xyz',
  'adapter-polymarket',
  // Audit 2026-05-24 G-6 fix (auditor G): three deployed adapter slugs
  // were missing from the allowlist so /api/deployments/address returned
  // 400 even when the registry held a valid address.
  'adapter-gmx',
  'adapter-morpho',
  'adapter-synthetix',
  // Wave A.7 split-contract slugs, Plinth's SPAN compute and oracle
  // reading live in separate Stylus contracts to fit EIP-170. Front end
  // never needs to call these directly (Plinth proxies the calls), but
  // the verifier/diagnostic page can show their deploy state.
  'plinth-math',
  'plinth-oracle',
  // Faucet for onboarding drops (Phase B).
  'faucet',
  // Aqueduct destination-chain pair (Phase B). The receiver is what
  // listens on the DEST chain for CCIP arrivals; claimback is the
  // SOURCE-chain refund path when the message expires.
  'aqueduct-receiver',
  'aqueduct-claimback',
  // Curator + Edict + Stoa + Research-attestation from Phase 0, added
  // so the Cohort/Brand-Kit pages can stop hardcoding their addresses.
  'curator',
  'edict',
  'stoa',
  'research-attestation',
]);

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug || !ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json(
      { error: 'invalid_slug', detail: `slug must be one of: ${[...ALLOWED_SLUGS].join(', ')}` },
      { status: 400 },
    );
  }
  const address = await loadContractAddress(slug);
  return NextResponse.json({ slug, address });
}
