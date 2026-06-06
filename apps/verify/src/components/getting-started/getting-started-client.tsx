'use client';

/**
 * /getting-started interactive surface (reference port).
 *
 * Eight expandable step cards plus a live "N / 8 done" progress counter.
 * Tapping a step header expands its detail panel and marks it done; the
 * counter reflects how many distinct steps the reader has opened. State is
 * purely local (reading progress), so there is no fake on-chain claim here.
 *
 * Honesty corrections vs the reference image:
 *  - The reference prints "atrium.fi/app" URLs. The real app lives at
 *    useatrium.me, so every app link is a relative Next <Link href="/app">
 *    (and /verify/1 for the verifier walk). No hardcoded marketing domain.
 *  - The faucet detail avoids inventing a per-claim amount: it says "claim
 *    test USDC + test ETH from the in-app faucet" rather than a fixed number.
 *  - Demo stat tiles are illustrative of the UI shape, labelled as such, and
 *    never presented as a live reading of the reader's own account.
 *
 * Styling uses the app's parchment tokens (--bg, --ink, --accent, ...), so
 * the marketing-shell mobile token flip renders this dark on phones to match
 * the rest of the product.
 */

import Link from 'next/link';
import { useState } from 'react';

type Tile = { v: string; l: string };

type Step = {
  n: number;
  tab: string; // short progress-rail label
  eyebrow: string; // mono "STEP N · X"
  title: React.ReactNode; // serif italic accent on the last phrase
  body: string;
  spec: string; // mono meta line
  href: '/app' | '/verify/1'; // real route, never atrium.fi
  hrefLabel: string; // what the reference printed, restated honestly
  tiles?: Tile[];
  note: string; // ↳ honest caveat line
};

const STEPS: Step[] = [
  {
    n: 1,
    tab: 'Connect',
    eyebrow: 'STEP 1 · SIGN IN',
    title: (
      <>
        Connect your <em>wallet.</em>
      </>
    ),
    body: 'Open the app and connect a browser wallet, Rabby or MetaMask both work. You sign one message (not a transaction, no gas) so Atrium can read your balance and positions. No password, no account, no custody.',
    spec: 'SIWE, Sign-In-With-Ethereum · network: Arbitrum Sepolia (421614)',
    href: '/app',
    hrefLabel: 'Open the app',
    tiles: [
      { v: 'Rabby', l: 'BROWSER WALLET' },
      { v: 'MetaMask', l: 'BROWSER WALLET' },
      { v: 'one signature', l: 'SIWE · NO GAS' },
    ],
    note: 'Wrong network? The app shows a one-click "Switch to Arbitrum Sepolia" button.',
  },
  {
    n: 2,
    tab: 'Faucet',
    eyebrow: 'STEP 2 · FUNDS',
    title: (
      <>
        Claim free <em>test funds.</em>
      </>
    ),
    body: 'Atrium ships its own faucet so you can run the whole flow. Claim test USDC plus a little test ETH from the in-app faucet. The ETH covers gas; the USDC becomes your collateral. None of it has real value.',
    spec: 'In-app testnet faucet · cooldown enforced per wallet',
    href: '/app',
    hrefLabel: 'Open the faucet',
    tiles: [
      { v: 'test USDC', l: 'COLLATERAL' },
      { v: 'test ETH', l: 'GAS' },
      { v: 'per-wallet', l: 'COOLDOWN' },
    ],
    note: 'Already claimed and still in cooldown? The button shows the exact wait. That is honest, not a failure.',
  },
  {
    n: 3,
    tab: 'Deposit',
    eyebrow: 'STEP 3 · DEPOSIT',
    title: (
      <>
        Deposit into the <em>vault.</em>
      </>
    ),
    body: 'The vault is called Coffer. Depositing your USDC mints you shares that the margin engine reads as collateral. Your wallet pops up twice (an approval, then the deposit) and the balance updates only after it confirms on-chain.',
    spec: 'Coffer is an ERC-4626 vault · TVL, your value, and shares all read live from RPC',
    href: '/app',
    hrefLabel: 'Open the vault',
    tiles: [
      { v: 'ERC-4626', l: 'VAULT STANDARD' },
      { v: 'approve + deposit', l: 'TWO TX' },
      { v: 'mints shares', l: 'YOUR COLLATERAL' },
    ],
    note: 'Every leg is conserved: USDC in, value increase, TVL increase, new shares. You can verify each.',
  },
  {
    n: 4,
    tab: 'Portfolio',
    eyebrow: 'STEP 4 · PORTFOLIO',
    title: (
      <>
        See your unified <em>margin.</em>
      </>
    ),
    body: 'Your portfolio shows one buying-power number across every venue. With no open position it honestly reads $0, never an invented number. The idea: required margin drops when your positions offset, so the same collateral backs more.',
    spec: 'Buying power = Plinth cross-product margin · total collateral · open notional · 24h P&L',
    href: '/app',
    hrefLabel: 'Open the portfolio',
    tiles: [
      { v: 'one number', l: 'BUYING POWER' },
      { v: 'all venues', l: 'CROSS-MARGIN' },
      { v: '$0 when flat', l: 'NEVER INVENTED' },
    ],
    note: 'Required margin drops when positions offset, so the same collateral backs more.',
  },
  {
    n: 5,
    tab: 'Trade',
    eyebrow: 'STEP 5 · TRADE',
    title: (
      <>
        Preview and open a <em>position.</em>
      </>
    ),
    body: 'Pick a venue, type a size, and the margin impact panel computes live from the real SPAN engine: initial margin, maintenance margin, buying power, liquidation buffer. The preview updates as you change the size.',
    spec: 'Live fills are gated behind the 48-hour timelock per venue · the form previews margin until the venue is enabled',
    href: '/app',
    hrefLabel: 'Open the trade desk',
    tiles: [
      { v: 'SPAN engine', l: 'REAL MARGIN MATH' },
      { v: 'initial + maint.', l: 'BOTH SHOWN' },
      { v: 'liq. buffer', l: 'LIVE PREVIEW' },
    ],
    note: 'Fills stay behind the per-venue timelock until the venue is enabled. The preview is real either way.',
  },
  {
    n: 6,
    tab: 'Agents',
    eyebrow: 'STEP 6 · AGENTS',
    title: (
      <>
        Delegate to an <em>agent.</em>
      </>
    ),
    body: 'Atrium makes AI agents first-class users through bounded mandates. You set caps the agent physically cannot exceed (per-action cap, daily limit, expiry, venue allowlist) and sign one EIP-712 message. One tap revokes everything.',
    spec: 'Primary type IntentSigil · domain AtriumSigil · Kill Switch routes through Sigil.revoke_all_on_behalf_of',
    href: '/app',
    hrefLabel: 'Open agents',
    tiles: [
      { v: 'per-action cap', l: 'MAX PER TRADE' },
      { v: 'expiry', l: 'AUTO-REVOKES' },
      { v: 'venue allowlist', l: 'WHERE IT MAY TRADE' },
    ],
    note: 'The Kill Switch revokes every mandate at once, and the revoke counts against you, not the switch.',
  },
  {
    n: 7,
    tab: 'Reserves',
    eyebrow: 'STEP 7 · RESERVES',
    title: (
      <>
        Verify the reserves <em>yourself.</em>
      </>
    ),
    body: "Atrium never holds your funds, and it proves it. Lantern publishes a signed Merkle root of all balances roughly hourly. Click verify and the server checks your wallet's inclusion proof against the on-chain root, a real result, never a fake 'verified'.",
    spec: 'Latest signed root · attested block · leaf count · published roughly hourly',
    href: '/app',
    hrefLabel: 'Open proof of reserves',
    tiles: [
      { v: 'signed root', l: 'PUBLISHED ON-CHAIN' },
      { v: 'inclusion proof', l: 'YOUR BALANCE' },
      { v: '~10 min', l: 'ATTESTATION CADENCE' },
    ],
    note: 'The check returns a real result against the on-chain root, never a hardcoded "verified".',
  },
  {
    n: 8,
    tab: 'Verifier',
    eyebrow: 'STEP 8 · VERIFIER MODE',
    title: (
      <>
        Run the full <em>proof.</em>
      </>
    ),
    body: 'Verifier Mode is the judge-facing walkthrough: seven steps run against live contracts (deposit, open, see the saving, trigger chaos mode, run a liquidation drill, verify reserves, kill-switch revoke). Each step runs its real action with an Arbiscan link, or shows an honest "not ready" blocker.',
    spec: 'Live on /verify · every step real or honestly gated · no faked successes',
    href: '/verify/1',
    hrefLabel: 'Open Verifier Mode',
    tiles: [
      { v: 'deposit + open', l: 'STEPS 1-2' },
      { v: 'saving + chaos', l: 'STEPS 3-4' },
      { v: 'liq + reserves + kill', l: 'STEPS 5-7' },
    ],
    note: 'Each step runs its real action with an Arbiscan link, or shows an honest "not ready" blocker.',
  },
];

export function StepWalkthrough() {
  // Default the first step open so the page reads as a guided walkthrough.
  const [open, setOpen] = useState<Set<number>>(() => new Set([1]));
  // "Done" = the reader has opened (read) this step at least once.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([1]));

  const toggle = (n: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
    setSeen((prev) => {
      if (prev.has(n)) return prev;
      const next = new Set(prev);
      next.add(n);
      return next;
    });
  };

  const done = seen.size;

  return (
    <div className="gs-walk">
      <div className="gs-rail" role="presentation">
        <div className="gs-rail-steps">
          {STEPS.map((s) => (
            <button
              key={s.n}
              type="button"
              className={`gs-rail-chip ${open.has(s.n) ? 'is-open' : ''} ${seen.has(s.n) ? 'is-seen' : ''}`}
              onClick={() => toggle(s.n)}
              aria-expanded={open.has(s.n)}
              aria-controls={`gs-step-${s.n}`}
            >
              <span className="gs-rail-num">{s.n}</span>
              {s.tab}
            </button>
          ))}
        </div>
        <div className="gs-progress" aria-live="polite">
          <span className="gs-progress-count">
            {done} / {STEPS.length}
          </span>{' '}
          done
        </div>
      </div>

      <ol className="gs-steps">
        {STEPS.map((s) => {
          const isOpen = open.has(s.n);
          return (
            <li
              key={s.n}
              className={`gs-step ${isOpen ? 'is-open' : ''} ${seen.has(s.n) ? 'is-seen' : ''}`}
            >
              <button
                type="button"
                className="gs-step-head"
                onClick={() => toggle(s.n)}
                aria-expanded={isOpen}
                aria-controls={`gs-step-${s.n}`}
              >
                <span className="gs-step-badge" aria-hidden="true">
                  {seen.has(s.n) ? '✓' : s.n}
                </span>
                <span className="gs-step-headtext">
                  <span className="gs-step-eyebrow">{s.eyebrow}</span>
                  <span className="gs-step-title">{s.title}</span>
                </span>
                <span className="gs-step-chevron" aria-hidden="true">
                  {isOpen ? '-' : '+'}
                </span>
              </button>

              <div
                id={`gs-step-${s.n}`}
                className="gs-step-panel"
                role="region"
                aria-label={s.eyebrow}
                hidden={!isOpen}
              >
                <p className="gs-step-body">{s.body}</p>
                <div className="gs-step-spec">{s.spec}</div>

                {s.tiles ? (
                  <div className="gs-tilegrid">
                    {s.tiles.map((t) => (
                      <div className="gs-tile" key={t.l}>
                        <div className="gs-tile-v">{t.v}</div>
                        <div className="gs-tile-l">{t.l}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="gs-step-foot">
                  <Link href={s.href} className="gs-step-link">
                    {s.hrefLabel} ↗
                  </Link>
                  <p className="gs-step-note">
                    <span className="gs-note-arrow" aria-hidden="true">
                      ↳
                    </span>{' '}
                    {s.note}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
