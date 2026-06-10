/**
 * Canonical venue list, single source of truth for the seven Portico-
 * whitelisted venues. Audit P-4 fix: prior to this file, "seven"/"six"/
 * "eight" all appeared in different surfaces (hero copy / impluvium SVG
 * with 6 circles / trade page "eight venues" / venue-chip-bar with 7
 * chips). Now every component reads `VENUES` and the count comes from
 * `VENUES.length`.
 *
 * RH-Chain is listed as an 8th planned adapter pending the public SDK
 * (per `human_left.md` #3); it is omitted from VENUES until it ships.
 *
 * Scope note (Launch-QA): VENUES is the MARGIN-SCOPE venue set (7). `/app/markets`
 * shows a different, intentional lens, the 9 deployed Portico ADAPTERS (its const
 * is named ADAPTERS, not VENUES, to avoid shadowing this one). The two differ
 * because the Hyperliquid adapter backs two venues (HIP-3 + HIP-4) and three
 * adapters (gmx/morpho/synthetix) are deployed scaffolds not yet in margin scope.
 * /architecture states the same "9 adapters / 7 margin scope" split.
 */
export interface Venue {
  /** Stable id used in URLs and Plinth's venue_id mapping. */
  id: string;
  /** Display name, e.g. "Hyperliquid HIP-3". */
  label: string;
  /** Short label for chip / table cells, e.g. "HL-HIP3". */
  shortLabel: string;
  /** Plinth venue_id. Matches contracts/portico-registry pinning. */
  venueId: number;
  /** Asset class kind for risk-class grouping. */
  kind: 'perp' | 'cash-equiv' | 'yield-bearing' | 'LP' | 'equity-perp' | 'binary';
  /** Plinth haircut in basis points (1000 = 10%). */
  haircutBps: number;
  /** Adapter contract slug (matches contracts/adapters/<slug>/). */
  adapterSlug: string;
  /**
   * Trading works against this venue TODAY. Only Aave Horizon is mock-backed
   * (MockAavePool) and openable; the rest are deployed-but-scaffolded (their
   * open_position reverts), so the UI must not badge them "live". Mirrors the
   * pendingVenue/scaffold truth in app/markets/page.tsx + /docs/honesty.
   */
  operational: boolean;
}

export const VENUES: Venue[] = [
  { id: 'hyperliquid', label: 'Hyperliquid HIP-3', shortLabel: 'HL-HIP3', venueId: 1, kind: 'perp', haircutBps: 1000, adapterSlug: 'hyperliquid', operational: false },
  { id: 'aave-horizon', label: 'Aave Horizon', shortLabel: 'AAVE-V3', venueId: 2, kind: 'cash-equiv', haircutBps: 100, adapterSlug: 'aave-horizon', operational: true },
  { id: 'pendle-v2', label: 'Pendle V2', shortLabel: 'PENDLE', venueId: 3, kind: 'yield-bearing', haircutBps: 500, adapterSlug: 'pendle', operational: false },
  { id: 'curve', label: 'Curve', shortLabel: 'CURVE', venueId: 4, kind: 'LP', haircutBps: 500, adapterSlug: 'curve', operational: false },
  { id: 'trade-xyz', label: 'Trade.xyz', shortLabel: 'TRADE', venueId: 5, kind: 'equity-perp', haircutBps: 1500, adapterSlug: 'trade-xyz', operational: false },
  { id: 'polymarket', label: 'Polymarket', shortLabel: 'PMK', venueId: 6, kind: 'binary', haircutBps: 5000, adapterSlug: 'polymarket', operational: false },
  { id: 'hl-hip4', label: 'Hyperliquid HIP-4', shortLabel: 'HL-HIP4', venueId: 7, kind: 'perp', haircutBps: 1000, adapterSlug: 'hyperliquid', operational: false },
];

export const VENUE_COUNT = VENUES.length;

export function venueLabel(venueId: number | null | undefined): string | null {
  // Audit R-3 fix: return null on null input so the filter expression can
  // short-circuit instead of constructing a "venue-null" string that
  // never matches any real label.
  if (venueId == null) return null;
  return VENUES.find((v) => v.venueId === venueId)?.label ?? `venue-${venueId}`;
}
