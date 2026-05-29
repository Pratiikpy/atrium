/**
 * Central product-copy map for Atrium's subsystems.
 *
 * Why this exists (Phase 1, legibility): the protocol's subsystems have
 * branded names (Plinth, Sigil, Lantern, ...) that are part of the visual
 * identity in `desing/` and the CLAUDE.md prototype contract - they STAY.
 * The product gap was never the names; it was that a trader could not tell
 * what each one DOES for them. So every subsystem carries three strings:
 *
 *   brand   - the canonical name (keep on landing/marketing; it is the identity)
 *   plain   - the plain-English label (lead with this in the working app + nav)
 *   benefit - one honest sentence of user value (use in subtitles + tooltips)
 *
 * Usage:
 *   import { SUBSYSTEMS } from '@/lib/atrium/copy';
 *   <h2>{SUBSYSTEMS.plinth.plain}
 *     <span className="text-muted text-xs">{SUBSYSTEMS.plinth.brand}</span>
 *   </h2>
 *   <p className="text-sm text-muted">{SUBSYSTEMS.plinth.benefit}</p>
 *
 * The `as const satisfies` keeps the shape typed (a bad key fails the build)
 * while preserving literal types for each string.
 */

export interface SubsystemLabel {
  /** Canonical branded name - the product identity. Keep on landing/marketing. */
  brand: string;
  /** Plain-English label - lead with this in the working app + navigation. */
  plain: string;
  /** One honest sentence of user value - for subtitles, tooltips, empty states. */
  benefit: string;
}

export const SUBSYSTEMS = {
  plinth: {
    brand: 'Plinth',
    plain: 'Margin engine',
    benefit:
      'Nets your risk across every venue into one buying-power number, so the same collateral backs more.',
  },
  coffer: {
    brand: 'Coffer',
    plain: 'Vault',
    benefit:
      'Holds your collateral as an ERC-4626 vault - deposits and withdrawals stay yours, not the venues’.',
  },
  sigil: {
    brand: 'Sigil',
    plain: 'Agent mandates',
    benefit:
      'Delegate trading to an agent with hard limits you sign yourself: per-action cap, daily count, expiry.',
  },
  vigil: {
    brand: 'Vigil',
    plain: 'Liquidation guard',
    benefit:
      'Watches your margin and unwinds positions in small steps before you ever go underwater.',
  },
  aqueduct: {
    brand: 'Aqueduct',
    plain: 'Cross-chain transfers',
    benefit:
      'Moves collateral across chains over Chainlink CCIP; it becomes buying power the moment it lands.',
  },
  lantern: {
    brand: 'Lantern',
    plain: 'Proof of reserves',
    benefit: 'Prove your vault balance on-chain in seconds - no trust required.',
  },
  rostrum: {
    brand: 'Rostrum',
    plain: 'Agent leaderboard',
    benefit: 'Ranks agents by real on-chain performance so you can choose who to delegate to.',
  },
  postern: {
    brand: 'Postern',
    plain: 'Session keys',
    benefit:
      'Passkey login plus scoped session keys, with a one-tap kill switch that revokes everything.',
  },
  codex: {
    brand: 'Codex',
    plain: 'Data API',
    benefit: 'Pay-per-call market and risk data over x402 - the same feeds the agents read.',
  },
  edict: {
    brand: 'Edict',
    plain: 'Access tiers',
    benefit: 'Optional KYC tiers that unlock features for jurisdictions that require them.',
  },
  tablet: {
    brand: 'Tablet',
    plain: 'Tax export',
    benefit: 'Download an auditor-grade tax history of your trades, by jurisdiction.',
  },
  praetor: {
    brand: 'Praetor',
    plain: 'Governance timelock',
    benefit: 'Every admin change waits behind a 48-hour timelock you can watch on-chain.',
  },
  portico: {
    brand: 'Portico',
    plain: 'Venue adapters',
    benefit: 'The open standard each venue plugs into, so new markets add without a fork.',
  },
  scribe: {
    brand: 'Scribe',
    plain: 'Indexer',
    benefit: 'Indexes on-chain events into the live numbers you see - nothing is faked.',
  },
  archive: {
    brand: 'Archive',
    plain: 'Research',
    benefit: 'Publishes signed backtests so strategy claims are verifiable, not marketing.',
  },
  curator: {
    brand: 'Curator',
    plain: 'Risk whitelist',
    benefit: 'Sets which venues and assets are allowed, and at what risk weight.',
  },
  cohort: {
    brand: 'Cohort',
    plain: 'Design partners',
    benefit: 'Trading firms testing Atrium - the count is on-chain and never inflated.',
  },
  stoa: {
    brand: 'Stoa',
    plain: 'Community',
    benefit: 'Where builders and traders coordinate around the protocol.',
  },
} as const satisfies Record<string, SubsystemLabel>;

export type SubsystemKey = keyof typeof SUBSYSTEMS;

/** Render helper: "Margin engine (Plinth)" style one-liner. */
export function label(key: SubsystemKey): string {
  const s = SUBSYSTEMS[key];
  return `${s.plain} (${s.brand})`;
}
