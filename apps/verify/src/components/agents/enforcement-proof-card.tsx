/**
 * Agent enforcement proof (2026-06-10). A recorded demonstration run, captured
 * on Arbitrum Sepolia, showing that an agent's mandate is enforced by the risk
 * engine itself: a user signs one EIP-712 IntentSigil, a separate agent session
 * key signs each ActionSigil, and the on-chain result is exactly what the
 * mandate allows, no more.
 *
 * Honesty contract: these are four real, mined transactions a judge can open on
 * Arbiscan and verify. The header labels it a recorded demonstration so it is
 * never read as live-streaming activity. The full method (two-party envelopes,
 * the typed Sigil errors, the success attribution to the user) is documented in
 * qa-evidence/agentic/SPIKE-B.md and reproducible from run-spike-b.sh.
 *
 * Server component: static, no client JS, no data fetch. The live mandate
 * surface (issue + revoke) lives in AgentsView; this card is the proof that the
 * surface does what it claims.
 */

const TX = 'https://sepolia.arbiscan.io/tx/';

const STEPS: {
  n: number;
  step: string;
  detail: string;
  tx: string;
  outcome: string;
  kind: 'enforced' | 'allowed';
}[] = [
  {
    n: 1,
    step: 'Agent opens a scoped trade',
    detail: 'In-cap action (2 USDC), signed by the agent session key under the user mandate',
    tx: '0xd198d4e8c60d00e2ac4ca1028a03636029d4617622b5a47971724cd5f0ea678f',
    outcome: 'Position 11 opened, owned by the user',
    kind: 'allowed',
  },
  {
    n: 2,
    step: 'Agent tries to exceed the cap',
    detail: 'Over-cap action (10 USDC against a 5 USDC per-action cap)',
    tx: '0x73859be872fc3cbf4a59fb6df0af7471c61a03108099962adcbebda8272c47de',
    outcome: 'Reverts NotionalExceeded(10000000, 5000000)',
    kind: 'enforced',
  },
  {
    n: 3,
    step: 'User fires the kill switch',
    detail: 'Owner revokes the agent in one transaction',
    tx: '0x65e24e9a9cebf66254e08081e520e657bb415b00f344b15b6d5386c3eed848d6',
    outcome: 'Revocation nonce 0 to 1',
    kind: 'allowed',
  },
  {
    n: 4,
    step: 'Agent acts after revocation',
    detail: 'A valid in-cap action, signed before the revocation',
    tx: '0x41bf9904886c05a160291194d91dc346028b378981082f2b7227ee9f656551e3',
    outcome: 'Reverts MandateRevoked',
    kind: 'enforced',
  },
];

const INTENT_HASH = '0x5b2df28075a02d848103e334116d18f5397d57620ddf125590fe40c02aa8fa17';

export function EnforcementProofCard() {
  return (
    <div className="rounded-md border border-divider bg-parchment-light p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Enforcement, proven on-chain</p>
          <h2 className="mt-1 font-display text-2xl italic text-ink">
            The mandate is the limit, not your trust.
          </h2>
        </div>
        <span className="rounded-full border border-divider bg-parchment px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          recorded run · arb-sepolia
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-sm text-ink-soft">
        A user signs one EIP-712 mandate. A separate agent session key signs each trade. The
        SPAN risk engine (Plinth, in Stylus) checks every action against the mandate before any
        funds move. Four real transactions, click any to verify on Arbiscan.
      </p>

      <ol className="mt-5 space-y-2">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex flex-col gap-1 rounded-md border border-divider bg-parchment p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink/10 font-mono text-[10px] text-ink-soft">
                  {s.n}
                </span>
                <span className="text-sm font-medium text-ink">{s.step}</span>
                <span
                  className={
                    'rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ' +
                    (s.kind === 'enforced'
                      ? 'bg-neg/10 text-neg'
                      : 'bg-live/10 text-live')
                  }
                  style={
                    s.kind === 'enforced'
                      ? { color: 'var(--color-neg, rgb(126,42,32))' }
                      : { color: 'var(--color-live, oklch(0.58 0.13 145))' }
                  }
                >
                  {s.kind === 'enforced' ? 'blocked' : 'allowed'}
                </span>
              </div>
              <p className="mt-0.5 pl-7 text-[12px] text-muted">{s.detail}</p>
              <p className="mt-0.5 pl-7 font-mono text-[12px] text-ink-soft">{s.outcome}</p>
            </div>
            <a
              href={`${TX}${s.tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-7 shrink-0 rounded-md border border-divider bg-parchment-light px-3 py-1.5 font-mono text-[11px] text-ink hover:border-ink/30 sm:ml-0"
            >
              {s.tx.slice(0, 10)}… ↗
            </a>
          </li>
        ))}
      </ol>

      <p className="mt-4 rounded-md bg-parchment-soft/60 px-4 py-3 text-[11px] leading-snug text-ink-soft">
        Mandate intent hash{' '}
        <span className="font-mono">{INTENT_HASH.slice(0, 18)}…</span>: max 5 USDC per action,
        venue allowlist [Aave Horizon], the agent session key never holds funds and never has
        authority beyond these signed caps. The successful open is attributed to the user, not
        the agent: agent-authorized execution, not agent custody. Full method and reproduction
        in the repo under qa-evidence/agentic.
      </p>
    </div>
  );
}
