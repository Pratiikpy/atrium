import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

/**
 * /docs/honesty - public-facing list of every place Atrium uses a mock,
 * a stub, a relay, or otherwise diverges from the "real production" path
 * on Arbitrum Sepolia testnet. Sourced from tripwires/ + human_left.md.
 *
 * Per docs/conventions/writing.md "Honesty patterns" + ui.md "Live data
 * discipline": these are the items where what looks like live integration
 * is actually a testnet workaround. We say so out loud, on the public
 * docs site, so judges + cohort partners + users can read it cold.
 */
export const metadata = {
  title: 'Honest disclosures',
  description:
    'Every place Atrium uses a mock, stub, or relay on Arbitrum Sepolia. Each item names the gap, why it exists, and when it goes away.',
  alternates: { canonical: '/docs/honesty' },
  openGraph: {
    title: 'Honest disclosures · Atrium',
    description:
      'Every place Atrium uses a mock, stub, or relay on Arbitrum Sepolia. Each item names the gap, why it exists, and when it goes away.',
    images: ['/opengraph-image'],
  },
};

interface Disclosure {
  id: string;
  surface: string;
  what: string;
  why: string;
  whenReal: string;
  tripwire?: string;
  severity: 'venue-mock' | 'relay' | 'interim' | 'waiting-on-3p';
}

export const DISCLOSURES: Disclosure[] = [
  {
    id: 'aave',
    surface: 'Aave Horizon adapter',
    what:
      'When you "deposit into Aave" on testnet, your USDC actually goes into MockAavePool, an Atrium-deployed contract that follows the exact Aave V3 interface. It mints aUSDC 1:1 and pretends to earn 5 bps yield per call.',
    why:
      'Aave V3 is not deployed on Arbitrum Sepolia in a usable form. We built the mock so the demo flow (deposit, accrue interest, withdraw) walks end to end on testnet.',
    whenReal: 'Mainnet flip (Year 2). Real Aave V3 lives on Arbitrum mainnet.',
    tripwire: 'tripwires/2026-05-25-mock-aave-pool.md',
    severity: 'venue-mock',
  },
  {
    id: 'pyth-equity',
    surface: 'Pyth equity price feeds (rTSLA, rAAPL, etc.)',
    what:
      'Equity prices on Pyth are only published to mainnet. On Sepolia, our Praetor multisig reads the mainnet feed, signs the price, and posts it to the Plinth oracle slot. Called a "Praetor-signed relay".',
    why: 'Pyth does not publish equity feeds on Sepolia as of 2026-05-25.',
    whenReal:
      'When Pyth ships native Sepolia equity feeds, OR mainnet (Year 2). We monitor Pyth release notes for the equity-Sepolia announcement.',
    severity: 'relay',
  },
  {
    id: 'hyperliquid',
    surface: 'Hyperliquid HIP-3 + HIP-4 perps',
    what:
      'Hyperliquid is not on Arbitrum Sepolia at all. Our HyperliquidHybridAdapter uses validator-signed attestations: a validator signs each action, the adapter checks the signature, and the action is recorded on-chain. Currently 1-of-1 (deployer EOA is the only validator); expands to 3-of-5 after the Safe migration.',
    why:
      'Hyperliquid is a separate L1; no Sepolia bridge exists. The validator pattern is how Hyperliquid itself ships their cross-chain integrations (HIP-3 attestation model).',
    whenReal:
      'Mainnet (Year 2) for native Hyperliquid integration. The 1-of-1 validator set expands to 3-of-5 when the Safe ceremony completes.',
    tripwire: 'tripwires/2026-05-25-validator-1-of-1.md',
    severity: 'venue-mock',
  },
  {
    id: 'robinhood',
    surface: 'Robinhood Chain adapter',
    what: 'Not built yet. Adapter scaffold exists; the implementation waits on Robinhood publishing their public SDK.',
    why: 'Robinhood Chain SDK is private as of 2026-05-25.',
    whenReal:
      'Within 14 days of Robinhood publishing the SDK. Tracked in `human_left.md` as a third-party blocker.',
    severity: 'waiting-on-3p',
  },
  {
    id: 'vigil-keeper',
    surface: 'Liquidation execution (Vigil keeper)',
    what:
      'The Vigil contract scaffolds liquidation queuing + execution, and the keeper service monitors paused accounts on a 5-minute GitHub Actions cron. Real `executeLiquidation` calls are gated behind the keeper EOA being staked for 1000 ETH (hardcoded testnet floor).',
    why:
      'Sepolia faucet caps at ~0.1 ETH, so no testnet keeper can clear 1000 ETH. Service ships in monitoring-only mode until founder runs the unblock sequence: redeploy Vigil + Plinth via Stylus + multisig call `set_keeper_min_stake_emergency(0.01 ether)` + stake a fresh keeper EOA.',
    whenReal:
      'Once the founder redeploy lands (Phase eta.2 ops; see `tripwires/2026-05-25-phase-eta-complete.md`). Code path activates automatically.',
    severity: 'interim',
  },
  {
    id: 'safe-migration',
    surface: 'Admin control (praetor_multisig)',
    what:
      'Every Atrium contract currently has `praetor_multisig = <deployer EOA>`. Anything dangerous (upgrade, parameter change, pause) requires that one key to sign.',
    why:
      'The deployer key bootstraps the system. The 3-of-5 Gnosis Safe ceremony is queued but requires 5 hardware wallets + a coordinated session.',
    whenReal:
      'After the Safe ceremony lands. Script `scripts/transfer-admin.s.sol` hands admin from the deployer EOA to a 3-of-5 Safe in one Foundry run.',
    severity: 'interim',
  },
  {
    id: 'partners',
    surface: 'Cohort partner logos',
    what:
      'No partner logos render on the cohort strip. The landing has an honest empty state: "No partners signed yet. cohort opens Month 2."',
    why:
      'Per `docs/conventions/writing.md`: partner names ship only with a signed source on file. None of the candidate partners (Pendle, Aave, Hyperliquid, IOSG, Variational, Horizen, Chainlink Labs, Pyth) have signed yet.',
    whenReal:
      'As each signs, we drop a `data/cohort/<partner>.json` file + logo SVG; the landing reads it and renders. No pre-announcement.',
    severity: 'interim',
  },
  {
    id: 'numbers',
    surface: 'Headline numbers on landing + mobile landing',
    what:
      'The fake-data components (Numbers.tsx, MobileLanding.tsx, Features.tsx PortfolioMock) with hardcoded $4.13M / $12.37M / setInterval increments were deleted in the 2026-05-28 honesty pass. The live-stats strip (NumbersSection) now renders "n/a" for any value not sourced from a live API. One surface is explicitly illustrative rather than "n/a": the "capital convergence" diagram (Impluvium) shows sample per-venue collateral figures, but it is labelled "illustrative schematic" so it is never read as live measurement.',
    why:
      'Per `docs/conventions/ui.md`: never show a placeholder number that looks real. The Lovable-port components with hardcoded $4.13M / $12.37M / setInterval increments are gone.',
    whenReal: 'Live as soon as Scribe + Plinth + Coffer return non-zero data after the timelock fires.',
    severity: 'interim',
  },
  {
    id: 'reference-agents',
    surface: 'Reference agents (Augur, Haruspex, Auspex)',
    what:
      'The three reference agents live as Vercel cron services and tick on schedule (Augur 5-min, Haruspex 1-hour, Auspex daily). Each tick reads its mandates from Codex + Scribe and records observation notes. Production behaviour would build an ActionSigil from the observation, sign it with the agent\'s session key, and submit via AtriumRouter.openPositionViaAdapter. The current scaffold logs `would-act-on: <intentHash>` instead so the agents are demonstrably alive without spending mandate budget or risking user collateral.',
    why:
      'Each agent that actually acts needs (1) a dedicated session-key EOA provisioned in Vercel env, (2) a signed IntentSigil mandate from a real user funded with USDC + collateral, (3) clear risk boundaries on what each strategy can do. Without (1)-(3) the agents would either no-op (no real mandate) or burn whatever testnet USDC the founder funds. Either path is worse than the honest stub.',
    whenReal:
      'When the cohort partner program lands (Month 2): partner provisions a mandate with explicit risk caps, agent session key is registered against it, the agent\'s tick handler swaps `would-act-on` for the real ActionSigil-build-and-submit path. Per-agent diff is ~30 LOC; the scaffold is mechanical.',
    severity: 'interim',
  },
  {
    id: 'scaffold-adapters',
    surface: 'GMX, Synthetix V3 + Morpho Blue adapters',
    what:
      'All three adapters are deployed and listed on /app/markets for design completeness, but `open_position` reverts with `ScaffoldNotImplemented`. The /app/trade venue list never offered them; the markets tile renders a "scaffold · open blocked" pill explicitly.',
    why:
      'Year-1 launch scope is the 7 production venues (Hyperliquid HIP-3, Aave Horizon, Pendle, Curve, Trade.xyz, Polymarket, Hyperliquid HIP-4). GMX, Synthetix V3, and Morpho Blue scaffolds exist as forward-compatible deployed contracts; before the Phase theta-followup lockdown, an open call would have pulled USDC via Coffer.adapterPull but never deployed into the upstream protocol, a funds-strand risk.',
    whenReal:
      'Year 2. Real Synthetix V3 `commitOrder` + sUSD-vs-USDC bridging, and real Morpho `supplyCollateral` + `borrow` + LLTV math. The contract scaffolds + tests are in place to make those follow-ups mechanical.',
    severity: 'interim',
  },
  {
    id: 'gas-sponsorship',
    surface: 'Sponsored gas (Postern ERC-4337 paymaster)',
    what:
      'Postern is the ERC-4337 + EIP-7702 layer; the passkey and session keys are live, but no Pimlico/bundler/verifying-paymaster is wired in the repo yet. On testnet today gas is self-funded: you pay your own Sepolia ETH, like any wallet. Onboarding + settings say so out loud, and /api/settings/gas returns sponsored:null, never a faked 0.',
    why:
      'The sponsored-gas leg needs a bundler + a funded verifying paymaster, neither of which is stood up on Sepolia yet. Only the gas-sponsorship leg is pending; the wallet + session keys work today.',
    whenReal:
      'When the Pimlico verifying paymaster is wired and funded (pre-mainnet). The Postern layer + session keys are already live; the sponsored-gas credit flips on with the paymaster.',
    severity: 'interim',
  },
  {
    id: 'ipfs-pinning',
    surface: 'Proof-of-reserves IPFS pinning (Lantern)',
    what:
      'Lantern signs and commits the Merkle root of all balances on-chain each cycle, and that root is verifiable now. The full leaf tree is not yet pinned to IPFS, so the per-wallet inclusion proof (verify your own balance is in the root) is gated. /lantern + /app/reserves say "once the tree is pinned" rather than faking the proof.',
    why:
      'Pinning the leaf tree needs a web3.storage (or equivalent) token, a founder credential not yet provisioned.',
    whenReal:
      'Once the attestor runs with a web3.storage token. The on-chain root + the client-side inclusion-proof verifier are already shipped; only the pinned-tree fetch is pending.',
    severity: 'interim',
  },
  {
    id: 'tax-tablet',
    surface: 'Tax report (Tablet computation service)',
    what:
      'The tax page computes UK CGT through the Tablet service (verify -> Tablet -> Scribe). Tablet is deployed and reachable and the chain returns 200, but its /summary response is incomplete (only realized_gain_usd; the page needs proceeds, cost basis, and tax owed), so the tax surface stays gated instead of showing a partial figure as final.',
    why:
      'Tablet /summary does not yet return the full CGT shape, so wiring it now would render an incomplete report as if it were complete.',
    whenReal:
      'When Tablet /summary returns proceeds + cost-basis + tax-owed and the page maps them. The verify -> Tablet -> Scribe chain already works; only the summary shape is pending.',
    severity: 'interim',
  },
];

const SEV_LABELS: Record<Disclosure['severity'], { label: string; color: string }> = {
  'venue-mock': { label: 'Venue mock', color: 'testnet' },
  'relay': { label: 'Multisig relay', color: 'testnet' },
  'interim': { label: 'Interim state', color: 'live' },
  'waiting-on-3p': { label: 'Third-party blocker', color: 'muted' },
};

export default function HonestyPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <section>
        <p className="eyebrow">Honesty</p>
        <h1 className="mt-2 font-display text-5xl italic text-ink">What is mock · what is relay</h1>
        <p className="mt-6 max-w-prose text-ink-soft">
          Atrium ships on Arbitrum Sepolia testnet in Year 1. Three of the venues we integrate
          (Aave V3, Pyth equity feeds, Hyperliquid) do not exist on Sepolia in a form we can use
          directly. We built mocks or relays so the user flow works end to end on testnet. We say
          so out loud below, with the exact mechanism and the timeline to "real". No claim on the
          landing, in the brand kit, or in the demo pretends these are the real upstream services.
        </p>
        <p className="mt-3 max-w-prose text-ink-soft">
          Every other integration on this page is real testnet code (Chainlink CCIP, Chainlink
          Data Feeds, Curve, Trade.xyz, Polymarket, USDC, x402, WebAuthn, EIP-712 mandates).
        </p>
      </section>

      <section className="mt-12 space-y-5">
        {DISCLOSURES.map((d) => {
          const sev = SEV_LABELS[d.severity];
          return (
            <article key={d.id} id={d.id} className="rounded-md border border-line bg-paper p-6">
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">{d.surface}</h2>
                <span
                  className={
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ' +
                    (sev.color === 'testnet' ? 'bg-testnet/15 text-testnet' :
                     sev.color === 'live'    ? 'bg-live-soft text-live'      :
                                               'bg-divider/30 text-muted')
                  }
                >
                  <span className={
                    'size-1.5 rounded-full ' +
                    (sev.color === 'testnet' ? 'bg-testnet' : sev.color === 'live' ? 'bg-live' : 'bg-muted')
                  } />
                  {sev.label}
                </span>
              </header>
              <Row label="What's actually happening" value={d.what} />
              <Row label="Why" value={d.why} />
              <Row label="When it becomes real" value={d.whenReal} />
              {d.tripwire && (
                <Row
                  label="Tripwire on file"
                  value={
                    <code className="font-mono text-[12.5px] text-ink-soft">{d.tripwire}</code>
                  }
                />
              )}
            </article>
          );
        })}
      </section>

      <footer className="mt-16 border-t border-divider pt-6 text-xs text-muted">
        <p>Last verified: 2026-06-05 (hostile-judge UI + repo audit).</p>
        <p className="mt-2">
          Source of truth for this page is the `tripwires/` directory + `human_left.md`. Every item
          above maps to a dated tripwire file that lives in the repo. If something on the live
          product contradicts a disclosure here, that is a bug. Email
          <a className="ml-1 text-ink hover:underline" href="mailto:security@useatrium.me">security@useatrium.me</a>.
        </p>
      </footer>
      </div>
    </MarketingShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1.5 text-[14.5px] leading-[1.55] text-ink-soft">{value}</div>
    </div>
  );
}
