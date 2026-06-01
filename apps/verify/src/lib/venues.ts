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
}

export const VENUES: Venue[] = [
  { id: 'hyperliquid', label: 'Hyperliquid HIP-3', shortLabel: 'HL-HIP3', venueId: 1, kind: 'perp', haircutBps: 1000, adapterSlug: 'hyperliquid' },
  { id: 'aave-horizon', label: 'Aave Horizon', shortLabel: 'AAVE-V3', venueId: 2, kind: 'cash-equiv', haircutBps: 100, adapterSlug: 'aave-horizon' },
  { id: 'pendle-v2', label: 'Pendle V2', shortLabel: 'PENDLE', venueId: 3, kind: 'yield-bearing', haircutBps: 500, adapterSlug: 'pendle' },
  { id: 'curve', label: 'Curve', shortLabel: 'CURVE', venueId: 4, kind: 'LP', haircutBps: 500, adapterSlug: 'curve' },
  { id: 'trade-xyz', label: 'Trade.xyz', shortLabel: 'TRADE', venueId: 5, kind: 'equity-perp', haircutBps: 1500, adapterSlug: 'trade-xyz' },
  { id: 'polymarket', label: 'Polymarket', shortLabel: 'PMK', venueId: 6, kind: 'binary', haircutBps: 5000, adapterSlug: 'polymarket' },
  { id: 'hl-hip4', label: 'Hyperliquid HIP-4', shortLabel: 'HL-HIP4', venueId: 7, kind: 'perp', haircutBps: 1000, adapterSlug: 'hyperliquid' },
];

export const VENUE_COUNT = VENUES.length;

export function venueLabel(venueId: number | null | undefined): string | null {
  // Audit R-3 fix: return null on null input so the filter expression can
  // short-circuit instead of constructing a "venue-null" string that
  // never matches any real label.
  if (venueId == null) return null;
  return VENUES.find((v) => v.venueId === venueId)?.label ?? `venue-${venueId}`;
}
