'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Five-step onboarding flow, pixel-matched to
 * `desing/Atrium App.standalone.html` file5.js (`Onboarding`).
 *
 * Step rail: Welcome · Authenticator · Faucet · Margin posted · Done.
 *
 * Honesty notes (deviate from prototype's setTimeout mocks):
 *  - Passkey step calls real `navigator.credentials.create()` when WebAuthn is
 *    available — no fake 2.4s `setTimeout`. If WebAuthn is missing or the
 *    user dismisses, we surface the actual browser error.
 *  - Faucet step reads `/api/faucet/status` — if the faucet contract isn't
 *    deployed (current state) the "Claim faucet" button is disabled and we
 *    render the prototype's row table with each drop marked `pending` plus
 *    the named blocking reason from the API.
 *  - Margin step reads `/api/portfolio/buying-power` — if Plinth isn't
 *    deployed yet (current state) we render the prototype card shape but
 *    fill each number with `pending` instead of fabricating $46,500.
 *  - Done step routes the three "next" cards to the real /app/* pages.
 */

type FaucetStatus = {
  available: boolean;
  reason?: string;
  drops: { token: string; amount: number; chain: 'arb-sepolia' | 'rh-chain' }[];
  source: 'pending' | 'live';
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
  const [step, setStep] = useState(0);
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="min-h-screen bg-parchment">
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
                    'inline-flex size-[22px] items-center justify-center rounded-full border font-mono text-[11px] ' +
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
          {step === 1 && <Authenticator onNext={next} />}
          {step === 2 && <Faucet onNext={next} />}
          {step === 3 && <MarginPosted onNext={next} />}
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
        Atrium is unified margin prime brokerage for the EVM. This is the open
        testnet. You&rsquo;ll need ninety seconds to set up an authenticator,
        claim a faucet drop, and post your first cross-margin position.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <FeatureRow
          icon={<Shield />}
          title="No seed phrase"
          desc="Postern uses a passkey on your device. Lost device? Recover through guardians."
        />
        <FeatureRow
          icon={<TradeIcon />}
          title="Gas is sponsored"
          desc="The first ten UserOperations are on us. You&rsquo;ll never see a gas dialog this session."
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

function Authenticator({ onNext }: { onNext: () => void }) {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.credentials !== 'undefined',
    );
  }, []);

  // Real WebAuthn. No fake setTimeout. If the browser supports it and the
  // user approves, we advance. Otherwise we surface the actual reason —
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
      onNext();
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
        <code className="font-mono text-ink">atrium.fi</code>.
      </p>

      <div className="mt-8 rounded-[12px] border border-divider bg-parchment px-6 py-6 text-center">
        <div
          className={
            'mx-auto flex size-[80px] items-center justify-center rounded-full text-ink ' +
            (signing ? 'animate-spin border-[1.5px] border-dashed border-ink' : 'border-[1.5px] border-solid border-ink')
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
          <p className="mt-3 text-xs text-[var(--color-terracotta)]">
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
    </>
  );
}

/* ----- Step 3: Faucet (real /api/faucet/status) -------------------------- */

function Faucet({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/faucet/status')
      .then((r) => r.json())
      .then((d: FaucetStatus) => setStatus(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Faucet status unavailable'));
  }, []);

  const drops = status?.drops ?? [
    { token: 'USDC', amount: 10000, chain: 'arb-sepolia' as const },
    { token: 'USDC', amount: 5000, chain: 'rh-chain' as const },
    { token: 'rAAPL', amount: 25, chain: 'rh-chain' as const },
    { token: 'WETH', amount: 3, chain: 'arb-sepolia' as const },
  ];

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
                  {d.amount.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{d.chain}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full border border-divider bg-parchment px-2 py-0.5 text-[11px] text-muted">
                    pending
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex gap-2.5">
        {status?.available ? (
          <PrimaryButton onClick={onNext} className="flex-1 justify-center">
            Claim faucet
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
      <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-muted">
        {error
          ? `Faucet status unavailable · ${error}`
          : status?.available
            ? 'Faucet rate-limited to one claim per address per month'
            : status?.reason ?? 'Faucet deploys with Coffer (Month 1 W2)'}
      </p>
    </>
  );
}

/* ----- Step 4: Margin Posted (real /api/portfolio/buying-power) ---------- */

function MarginPosted({ onNext }: { onNext: () => void }) {
  const [bp, setBp] = useState<BuyingPower | null>(null);
  useEffect(() => {
    fetch('/api/portfolio/buying-power')
      .then((r) => r.json())
      .then((d: BuyingPower) => setBp(d))
      .catch(() => setBp({ currentUsd: null, source: 'pending' }));
  }, []);

  const isLive = bp?.source === 'plinth' && bp.currentUsd != null;
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
              {isLive ? '—' : 'pending'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Utilisation</p>
            <p className="mt-2 font-mono text-base font-medium text-ink">
              {isLive ? '—' : 'pending'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Headroom</p>
            <p className="mt-2 font-mono text-base font-medium text-ink">
              {isLive ? '—' : 'pending'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2.5">
        <PrimaryButton onClick={onNext} className="flex-1 justify-center">
          Open portfolio <Arrow />
        </PrimaryButton>
      </div>
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
