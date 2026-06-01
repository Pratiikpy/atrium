import { keccak256, toBytes } from 'viem';

/**
 * Venue -> instrument-id, single source of truth.
 *
 * 062-FE7 fix (2026-05-30): the mandate hook (use-issue-mandate.ts) and the
 * server recompute (api/agents/issue-mandate/route.ts) used to hardcode
 * `instrumentsAllowed: []`. Sigil's `caps_respected` rejects any action whose
 * `instrument_id` is not in `instruments_allowed` (eip712.rs:424 does
 * `.any(|i| *i == action.instrument_id)`, which is always false for an empty
 * list), so every UI-issued mandate was dead on the agent's first action.
 *
 * The open path (use-open-position.ts) derives the instrument_id it submits as
 * `keccak256(toBytes(symbol))`. A mandate only authorizes that action if it
 * carries the SAME id. This module is the shared derivation both paths read so
 * they can never drift. The aave-horizon mapping matches the canonical
 * on-chain fill: scripts/build-aave-fill-envelope.mjs:48
 * `INSTRUMENT = keccak256(toBytes('USDC-LEND'))`.
 */
const SYMBOL_BY_VENUE: Record<string, string> = {
  hyperliquid: 'HSLA-PERP',
  'aave-horizon': 'USDC-LEND',
  'pendle-v2': 'PT-USDC-DEC25',
  curve: '3CRV',
  'trade-xyz': 'rTSLA-PERP',
  polymarket: 'ELECTION-2026',
  'hl-hip4': 'HSLA2-PERP',
};

/** Instrument symbol for a venue slug, or null if the venue is unknown. */
export function instrumentSymbolForVenue(slug: string): string | null {
  return SYMBOL_BY_VENUE[slug] ?? null;
}

/** 32-byte instrument id for a venue slug, or null if the venue is unknown. */
export function instrumentIdForVenue(slug: string): `0x${string}` | null {
  const symbol = SYMBOL_BY_VENUE[slug];
  return symbol ? keccak256(toBytes(symbol)) : null;
}

/**
 * Map a venue allowlist to its instrument ids for a Sigil mandate. Throws on
 * an unknown venue rather than silently dropping it, so a mandate can never be
 * issued that authorizes fewer instruments than the user selected.
 */
export function instrumentIdsForVenues(slugs: string[]): `0x${string}`[] {
  return slugs.map((slug) => {
    const id = instrumentIdForVenue(slug);
    if (!id) throw new Error(`no instrument mapping for venue: ${slug}`);
    return id;
  });
}
