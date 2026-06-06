'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';
import { useFaucetClaim } from '@/lib/use-faucet-claim';
import { VENUES, VENUE_COUNT } from '@/lib/venues';

/**
 * Five-step onboarding flow, pixel-matched to
 * `design/Atrium App.standalone.html` file5.js (`Onboarding`).
 *
 * Step rail: Welcome · Authenticator · Faucet · Margin posted · Done.
 *
 * Honesty notes (deviate from prototype's setTimeout mocks):
 *  - Passkey step calls real `navigator.credentials.create()` when WebAuthn is
 *    available, no fake 2.4s `setTimeout`. If WebAuthn is missing or the
 *    user dismisses, we surface the actual browser error.
 *  - Faucet step reads `/api/faucet/status`, if the faucet contract isn't
 *    deployed (current state) the "Claim faucet" button is disabled and we
 *    render the prototype's row table with each drop marked `pending` plus
 *    the named blocking reason from the API.
 *  - Margin step reads `/api/portfolio/buying-power`, if Plinth isn't
 *    deployed yet (current state) we render the prototype card shape but
 *    fill each number with `pending` instead of fabricating $46,500.
 *  - Done step routes the three "next" cards to the real /app/* pages.
 */

// Bug-hunt fix (2026-06-02): /api/faucet/status returns usdcDrop/ethDrop numbers
// and source:'faucet' (not a `drops` array, not source:'live'), so the Step-3
// "testnet drop" table built from `status.drops` was ALWAYS empty even when the
// faucet is live + stocked. Align the type to the route; build the rows below.
type FaucetStatus = {
  available: boolean;
  reason?: string;
  usdcDrop?: number;
  ethDrop?: number;
  faucetUsdcBalance?: number;
  source: 'pending' | 'faucet';
};

type BuyingPower = {
  currentUsd: string | null;
  source: 'plinth' | 'pending';
};

const STEPS = [
  { label: 'Welcome' },
  { label: 'Authenticator' },
  { label: 'Faucet' },
  { label: 'Margin posted' },
  { label: 'Done' },
] as const;

export function OnboardingFlow() {
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem('atrium_onboarding_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        return typeof parsed.step === 'number' ? parsed.step : 0;
      }
    } catch { /* ignore */ }
    return 0;
  });
  const next = () => setStep((s: number) => {
    const n = Math.min(s + 1, STEPS.length - 1);
    try { localStorage.setItem('atrium_onboarding_v1', JSON.stringify({ step: n })); } catch { /* ignore */ }
    return n;
  });
  const back = () => setStep((s: number) => {
    const n = Math.max(s - 1, 0);
    try { localStorage.setItem('atrium_onboarding_v1', JSON.stringify({ step: n })); } catch { /* ignore */ }
    return n;
  });

  return (
    <div className="atrium-onboarding-flow mobile-dark-doc min-h-screen bg-parchment">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="font-display text-xl italic text-ink">
          Atrium
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-status-amber)]/30 bg-[var(--color-status-amber)]/10 px-3 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-status-amber)]">
          <span className="size-1.5 rounded-full bg-[var(--color-status-amber)]" />
          testnet · arb-sepolia
        </span>
      </div>

      {/* Stage: left rail + card */}
      <div className="mx-auto grid w-full max-w-[980px] gap-12 px-8 pb-16 pt-6 md:grid-cols-[220px_1fr]">
        {/* Rail */}
        <ol className="flex flex-col gap-1 md:sticky md:top-6 md:h-fit">
          {STEPS.map((s, i) => {
            const state = i === step ? 'current' : i < step ? 'done' : 'upcoming';
            return (
              <li
                key={s.label}
                className={
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ' +
                  (state === 'current'
                    ? 'text-ink'
                    : state === 'done'
                      ? 'text-ink-soft'
                      : 'text-muted')
                }
              >
                <span
                  className={
                    'inline-flex size-[44px] items-center justify-center rounded-full border font-mono text-[13px] ' +
                    (state === 'current'
                      ? 'border-ink bg-ink text-parchment'
                      : state === 'done'
                        ? 'border-[var(--color-status-green)] bg-[var(--color-status-green)] text-parchment'
                        : 'border-divider bg-parchment text-muted')
                  }
                >
                  {state === 'done' ? <Check size={11} /> : i + 1}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        {/* Card */}
        <section className="min-h-[380px] rounded-[16px] border border-divider bg-parchment-light px-11 py-10 shadow-[0_1px_1px_rgba(0,0,0,0.02),0_10px_30px_rgba(0,0,0,0.04)] md:px-12">
          {step === 0 && <Welcome onNext={next} />}
          {step === 1 && <Authenticator onNext={next} onBack={back} />}
          {step === 2 && <Faucet onNext={next} onBack={back} />}
          {step === 3 && <MarginPosted onNext={next} onBack={back} />}
          {step === 4 && <DoneStep />}
        </section>
      </div>
    </div>
  );
}

/* ----- Step 1: Welcome --------------------------------------------------- */

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <Eyebrow>01 · Welcome</Eyebrow>
      <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-[-0.022em] text-ink">
        Step inside the atrium.
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-[1.55] text-ink-soft">
        Atrium gives you one buying-power number across every venue. Post collateral
        once and the same balance backs positions on Hyperliquid, Aave, Pendle and more,
        because your risks net instead of being re-posted. Ninety seconds: passkey,
        faucet, your first cross-margin position.
      </p>

      {/* Benefit callout: lead onboarding with the wedge, not jargon. */}
      <div className="mt-5 rounded-[12px] border border-divider bg-parchment-soft/40 px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-muted">Why Atrium</p>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-ink">
          Without unified margin you post $100K at each venue, so $300K is tied up. Here, one
          $100K deposit backs Hyperliquid, Aave and Pendle together.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <FeatureRow
          icon={<Shield />}
          title="No seed phrase"
          desc="Postern uses a passkey on your device. Lost device? Recover through guardians."
        />
        <FeatureRow
          icon={<TradeIcon />}
          title="Gas sponsorship is coming"
          desc="Your first ten UserOperations will be on us once the paymaster ships. On testnet today gas is self-funded, the same status shown in Settings."
        />
        <FeatureRow
          icon={<ReservesIcon />}
          title="Funds are testnet only"
          desc="Nothing on this network has economic value. Test markets, agents, and strategies safely."
        />
      </div>

      <div className="mt-8 flex gap-2.5">
        <PrimaryButton onClick={onNext}>
          Set up authenticator <Arrow />
        </PrimaryButton>
        <Link
          href={'/app/portfolio' as any}
          className="inline-flex items-center justify-center rounded-md border border-divider bg-parchment px-5 py-3 text-sm font-medium text-ink-soft hover:border-ink/30 hover:text-ink"
        >
          Skip to app →
        </Link>
      </div>
    </>
  );
}

/* ----- Step 2: Authenticator (real WebAuthn) ----------------------------- */

function Authenticator({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  // Phase eta.7: second-device warning per FULL_FLOW_DESIGN §172-174.
  // After the first passkey is created, surface the recovery risk before
  // letting the user proceed to deposit. They must dismiss "I understand"
  // to advance to Faucet. The warning is the gate; the second authenticator
  // setup itself is deferred to /app/settings once they finish onboarding.
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.credentials !== 'undefined',
    );
  }, []);

  // Real WebAuthn. No fake setTimeout. If the browser supports it and the
  // user approves, we advance. Otherwise we surface the actual reason -
  // browser unsupported, user dismissed, etc. The credential itself isn't
  // persisted yet (Postern's credential storage ships with the contracts in
  // Month 1 W2); for now the ceremony itself is the truthful signal.
  async function start() {
    if (!supported) {
      setError(
        "Your browser doesn't expose WebAuthn. Use a recent Chrome, Safari, Firefox or Edge.",
      );
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      await navigator.credentials.create({
        publicKey: {
          rp: { name: 'Atrium', id: window.location.hostname },
          user: { id: userId, name: 'atrium-testnet', displayName: 'Atrium testnet user' },
          challenge,
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'preferred',
          },
          timeout: 60_000,
          attestation: 'none',
        },
      });
      // Show recovery warning before letting them go to faucet/deposit.
      setShowWarning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Authenticator dismissed.';
      setError(msg);
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <Eyebrow>02 · Authenticator</Eyebrow>
      <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-[-0.022em] text-ink">
        Create your passkey.
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-[1.55] text-ink-soft">
        Atrium uses a WebAuthn passkey instead of a seed phrase. Your browser
        or hardware authenticator will produce a key pair scoped to{' '}
        <code className="font-mono text-ink">useatrium.me</code>.
      </p>

      <div className="mt-8 rounded-[12px] border border-divider bg-parchment px-6 py-6 text-center">
        <div
          className={
            'mx-auto flex size-[80px] items-center justify-center rounded-full text-ink ' +
            (signing ? 'animate-pulse border-[1.5px] border-dashed border-ink' : 'border-[1.5px] border-solid border-ink')
          }
        >
          <Shield size={28} />
        </div>
        <p className="mt-4 text-[15px] font-medium text-ink">
          {signing ? 'Waiting for authenticator…' : 'Touch to authenticate'}
        </p>
        <p className="mt-2 text-xs text-muted">
          {signing
            ? 'Approve on your device'
            : 'ATRIUM · Yubikey 5C · Touch ID · Windows Hello'}
        </p>
        <button
          type="button"
          onClick={start}
          disabled={signing || supported === false}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-ink px-5 py-3 text-sm font-medium text-parchment hover:bg-ink/90 disabled:opacity-50"
        >
          {signing ? 'Waiting…' : supported === false ? 'WebAuthn unavailable' : 'Authenticate'}
        </button>
        {error && (
          <p className="mt-3 text-xs text-[var(--color-accent)]">
            {error}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-center gap-5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Check size={11} /> No seed phrase
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check size={11} /> Phishing-resistant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check size={11} /> Recoverable
        </span>
      </div>

      {showWarning && <SecondDeviceWarning onContinue={onNext} onCancel={() => setShowWarning(false)} />}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-ink">
          ← Back
        </button>
        <button type="button" onClick={onNext} className="text-xs text-muted hover:text-ink">
          Skip for now (set up later in Settings)
        </button>
      </div>
    </>
  );
}

/* ----- Modal: Second-device warning (Phase eta.7) ------------------------ */

function SecondDeviceWarning({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  function remindLater() {
    try {
      localStorage.setItem('atrium_second_device_remind', String(Date.now() + 86_400_000));
    } catch { /* ignore */ }
    onContinue();
  }

  // Check if dismissed within 24h
  const dismissed = (() => {
    try {
      const ts = localStorage.getItem('atrium_second_device_remind');
      return ts && Date.now() < parseInt(ts, 10);
    } catch { return false; }
  })();
  if (dismissed) {
    // Auto-advance if user previously dismissed
    onContinue();
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="second-device-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="max-w-md rounded-[14px] border border-divider bg-parchment p-7 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          Important · before you deposit
        </p>
        <h2 id="second-device-title" className="mt-2 font-display text-[24px] italic leading-[1.2] text-ink">
          Set up a second device before deposit.
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55] text-ink-soft">
          A single passkey on a single device is one lost phone away from total loss. Atrium ships
          three recovery paths; setup lands in Settings, Recovery before mainnet (that tab is a
          roadmap banner today). On testnet there is no real value at risk.
        </p>
        <ul className="mt-4 space-y-2.5 text-[13px] leading-[1.55] text-ink-soft">
          <li className="flex gap-2.5">
            <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-testnet" />
            <span><strong className="text-ink">Recovery passkey on a second device</strong>  iPad, second phone, laptop. Add it from /app/settings  Recovery.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-testnet" />
            <span><strong className="text-ink">3 recovery guardians</strong>  trusted EOAs that can co-sign a passkey reset. Set up in /app/settings  Recovery.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-testnet" />
            <span><strong className="text-ink">Authenticator app</strong>  Authy, 1Password, Bitwarden. Backup TOTP code stored encrypted.</span>
          </li>
        </ul>
        <p className="mt-4 rounded-md border border-testnet/30 bg-testnet/5 px-3 py-2 text-[11.5px] leading-[1.5] text-ink">
          You can dismiss this for now and use the faucet, but Atrium will surface it again before
          your first mainnet deposit. Testnet has no real funds at risk.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-[40px] items-center rounded-full border border-divider bg-parchment-light px-4 text-[13px] text-ink hover:border-ink/30"
          >
            Back to authenticator
          </button>
          <button
            type="button"
            onClick={remindLater}
            className="inline-flex h-[40px] items-center rounded-full border border-divider bg-parchment-light px-4 text-[13px] text-muted hover:border-ink/30"
          >
            Remind me later
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-[40px] items-center rounded-full bg-ink px-5 text-[13px] font-medium text-parchment hover:bg-ink/90"
          >
            I understand · continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----- Step 3: Faucet (real /api/faucet/status) -------------------------- */

function Faucet({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const wallet = useScopedWallet();
  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { status: claimStatus, claim } = useFaucetClaim();
  const claimBusy =
    claimStatus.kind === 'resolving' ||
    claimStatus.kind === 'submitting' ||
    claimStatus.kind === 'claiming';

  useEffect(() => {
    // Phase theta audit follow-up: scope to the connected wallet so the
    // cooldown + dropped-already check reads the user's history, not the
    // demo wallet's. Faucet route already supported ?wallet= since audit
    // U-28; this wires the connected-wallet through.
    fetch(walletQuery('/api/faucet/status', wallet))
      .then((r) => r.json())
      .then((d: FaucetStatus) => setStatus(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Faucet status unavailable'));
  }, [wallet]);

  // Build the drop rows from the real route fields (usdcDrop/ethDrop).
  const drops: { token: string; amount: number; chain: 'arb-sepolia' }[] = status
    ? [
        { token: 'USDC', amount: status.usdcDrop ?? 0, chain: 'arb-sepolia' },
        { token: 'ETH', amount: status.ethDrop ?? 0, chain: 'arb-sepolia' },
      ]
    : [];

  return (
    <>
      <Eyebrow>03 · Faucet</Eyebrow>
      <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-[-0.022em] text-ink">
        Claim your testnet drop.
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-[1.55] text-ink-soft">
        Atrium sends each new account a fixed package of test assets so you can
        experience real cross-margin. None of this has economic value.
      </p>

      <div className="mt-8 overflow-hidden rounded-md border border-divider">
        <table className="w-full text-sm">
          <thead className="bg-parchment-soft/40 text-[11px] uppercase tracking-wider text-label">
            <tr>
              <th className="px-3 py-2 text-left font-normal">Token</th>
              <th className="px-3 py-2 text-left font-normal">Amount</th>
              <th className="px-3 py-2 text-left font-normal">Network</th>
              <th className="px-3 py-2 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {drops.map((d) => (
              <tr key={`${d.token}-${d.chain}`}>
                <td className="px-3 py-2.5 font-mono font-medium text-ink">{d.token}</td>
                <td className="px-3 py-2.5 font-mono text-ink">
                  {d.amount.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{d.chain}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full border border-divider bg-parchment px-2 py-0.5 text-[11px] text-muted">
                    {claimStatus.kind === 'success' ? 'claimed' : 'pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status?.available &&
        status.usdcDrop != null &&
        status.usdcDrop > 0 &&
        status.faucetUsdcBalance != null &&
        status.faucetUsdcBalance < status.usdcDrop * 4 && (
          <p className="mt-3 text-[11px] uppercase tracking-wider text-testnet">
            Faucet running low · about {Math.floor(status.faucetUsdcBalance / status.usdcDrop)} claims left before it is topped up
          </p>
        )}

      <div className="mt-8 flex gap-2.5">
        {claimStatus.kind === 'success' ? (
          <PrimaryButton onClick={onNext} className="flex-1 justify-center">
            Continue →
          </PrimaryButton>
        ) : status?.available ? (
          <PrimaryButton
            onClick={() => { if (!claimBusy) claim(); }}
            className="flex-1 justify-center"
          >
            {claimBusy ? 'Claiming…' : 'Claim faucet'}
          </PrimaryButton>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex flex-1 items-center justify-center rounded-md bg-ink/40 px-5 py-3 text-sm font-medium text-parchment"
          >
            Faucet pending
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-md border border-divider bg-parchment px-5 py-3 text-sm font-medium text-ink-soft hover:border-ink/30 hover:text-ink"
        >
          Skip →
        </button>
      </div>
      {(claimStatus.kind === 'claiming' || claimStatus.kind === 'success') && (
        <p className="mt-3 text-center text-xs text-live">
          {claimStatus.kind === 'success' ? 'Claimed · ' : 'Claim submitted · '}
          <a
            href={`https://sepolia.arbiscan.io/tx/${claimStatus.hash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {claimStatus.hash.slice(0, 8)}…{claimStatus.hash.slice(-4)}
          </a>
        </p>
      )}
      {claimStatus.kind === 'error' && (
        <p className="mt-3 text-center text-xs text-neg">Claim failed · {claimStatus.reason}</p>
      )}
      <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-muted">
        {error
          ? `Faucet status unavailable · ${error}`
          : status?.available
            ? 'Faucet rate-limited to one claim per address per month'
            : status?.reason ?? 'Faucet deploys with Coffer (Month 1 W2)'}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-ink">
          ← Back
        </button>
        <div className="text-right text-[11px] text-muted">
          Need testnet ETH?{' '}
          <a href="https://faucet.quicknode.com/arbitrum/sepolia" target="_blank" rel="noreferrer" className="underline hover:text-ink">QuickNode</a>
          {' · '}
          <a href="https://www.alchemy.com/faucets/arbitrum-sepolia" target="_blank" rel="noreferrer" className="underline hover:text-ink">Alchemy</a>
        </div>
      </div>
    </>
  );
}

/* ----- Step 4: Margin Posted (real /api/portfolio/buying-power) ---------- */

function MarginPosted({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const wallet = useScopedWallet();
  const [bp, setBp] = useState<BuyingPower | null>(null);
  useEffect(() => {
    // Phase theta audit follow-up: read buying power for the CONNECTED
    // user, Step 4 of onboarding shows "you just deposited X, your
    // buying power is now Y". Pre-fix it would have shown the demo
    // wallet's buying power as the success-confirmation number, which
    // is meaningless to the user who just funded their own wallet.
    fetch(walletQuery('/api/portfolio/buying-power', wallet))
      .then((r) => r.json())
      .then((d: BuyingPower) => setBp(d))
      .catch(() => setBp({ currentUsd: null, source: 'pending' }));
  }, [wallet]);

  const isLive = bp?.source === 'plinth' && bp.currentUsd != null && parseFloat(bp.currentUsd) > 0;
  const buyingPower = isLive ? `$${bp!.currentUsd}` : 'pending';

  return (
    <>
      <Eyebrow>04 · Plinth</Eyebrow>
      <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-[-0.022em] text-ink">
        Cross-margin posted.
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-[1.55] text-ink-soft">
        Your faucet drop is now collateral. Plinth computes your buying power
        across every live venue and your portfolio is ready to trade.
      </p>

      <div className="mt-8 overflow-hidden rounded-[12px] border border-ink px-7 py-7 text-center">
        <p className="text-[11px] uppercase tracking-wider text-muted">
          Buying power · 3.0× portfolio margin
        </p>
        <p className="mt-3.5 font-mono text-[48px] leading-none tracking-[-0.025em] text-ink">
          {buyingPower}
        </p>
        <p
          className={
            'mt-3 text-[11px] uppercase tracking-wider ' +
            (isLive ? 'text-[var(--color-status-green)]' : 'text-muted')
          }
        >
          {isLive ? '● Plinth · margin ok' : '● Plinth · source built · deploy Month 1 W2'}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-divider pt-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Collateral</p>
            <p className="mt-2 font-mono text-base font-medium text-ink">
              {isLive ? '-' : 'pending'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Utilisation</p>
            <p className="mt-2 font-mono text-base font-medium text-ink">
              {isLive ? '-' : 'pending'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Headroom</p>
            <p className="mt-2 font-mono text-base font-medium text-ink">
              {isLive ? '-' : 'pending'}
            </p>
          </div>
        </div>
      </div>

      {/* Item 7: the benefit LANDS here. The welcome step pitched the wedge;
          this step is the confirmation: the user's one balance now spans
          every whitelisted venue, not split between them. Buying power is
          the live Plinth read (or honest pending); the venue chips + count
          are the real VENUES source of truth. No fabricated numbers. */}
      <div className="mt-6 rounded-[12px] border border-divider bg-parchment-soft/40 px-6 py-5">
        <p className="text-[11px] uppercase tracking-wider text-muted">What just happened</p>
        <p className="mt-1.5 text-[14px] leading-[1.5] text-ink">
          {isLive ? (
            <>
              Your <strong className="font-medium">{buyingPower}</strong> of buying power works on
              any of these {VENUE_COUNT} venues: the same balance, not split between them.
            </>
          ) : (
            <>
              Once Plinth deploys, one deposit gives you buying power across all {VENUE_COUNT}{' '}
              venues at once, and you never re-post collateral per venue.
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {VENUES.map((v) => (
            <span
              key={v.id}
              className="rounded-full border border-divider bg-parchment px-2.5 py-1 font-mono text-[11px] text-ink-soft"
            >
              {v.shortLabel}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          Without unified margin you would post separately at each venue. Plinth nets your risk into
          one number, so the same collateral backs them all.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-ink">
          ← Back
        </button>
        <PrimaryButton onClick={onNext} className="flex-1 ml-3 justify-center">
          Open portfolio <Arrow />
        </PrimaryButton>
      </div>
      {!isLive && (
        <p className="mt-3 text-center text-[11px] text-muted">
          Deposit first ·{' '}
          <Link href="/app/vault" className="underline hover:text-ink">Go to vault</Link>
        </p>
      )}
    </>
  );
}

/* ----- Step 5: Done ------------------------------------------------------ */

function DoneStep() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto flex size-[88px] items-center justify-center rounded-full bg-[var(--color-status-green)]/14 text-[var(--color-status-green)]">
        <Check size={36} />
      </div>
      <h1 className="mt-5 font-display text-[32px] leading-[1.1] tracking-[-0.022em] text-ink">
        You&rsquo;re ready.
      </h1>
      <p className="mx-auto mt-3 max-w-prose text-[15px] leading-[1.55] text-ink-soft">
        Three things you can do next.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <NextCard
          href="/app/portfolio"
          icon={<PortfolioIcon />}
          title="See your portfolio"
          desc="Plinth health, positions, P&L"
        />
        <NextCard
          href="/app/trade"
          icon={<TradeIcon />}
          title="Place a trade"
          desc="Seven venues, one signature"
        />
        <NextCard
          href="/app/agents"
          icon={<AgentsIcon />}
          title="Delegate to an agent"
          desc="Issue your first Sigil"
        />
      </div>
    </div>
  );
}

/* ----- Shared atoms ------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-muted">{children}</p>;
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] items-start gap-3.5">
      <div className="flex size-8 items-center justify-center rounded-[10px] border border-divider bg-parchment-soft/40 text-ink-soft">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-2 text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90 ${className}`}
    >
      {children}
    </button>
  );
}

function NextCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href as any}
      className="block rounded-[10px] border border-divider bg-parchment p-[18px] text-left text-ink transition-[border-color,transform] hover:-translate-y-0.5 hover:border-ink"
    >
      <div className="mb-3 flex size-7 items-center justify-center rounded-lg border border-divider bg-parchment-soft/40 text-ink-soft">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </Link>
  );
}

/* ----- Inline icons (match app-shell.tsx stroke set) --------------------- */

function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
function Shield({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L13 4v4c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V4z" />
    </svg>
  );
}
function TradeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12L6 8L9 10L14 4" />
    </svg>
  );
}
function ReservesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L13 4v4c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V4z" />
      <path d="M5.5 8L7 9.5L10.5 6" />
    </svg>
  );
}
function PortfolioIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6h12" />
    </svg>
  );
}
function AgentsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
    </svg>
  );
}
