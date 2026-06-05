'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useQuery } from '@tanstack/react-query';
import { CodexLiveStatus } from '@/components/docs/codex-live';

/**
 * /app/integrations - the programmable surfaces of Atrium in one place:
 * the Codex data API, agent delegation via Sigil mandates, and proof of
 * reserves. Each card carries a real signal where one exists (Codex worker
 * health, latest Lantern attestation) and honest CTAs to the live surface.
 */

function ReservesSignal() {
  const { data, isLoading } = useQuery({
    queryKey: ['integrations-reserves'],
    queryFn: async () => {
      const r = await fetch('/api/lantern/latest');
      if (!r.ok) throw new Error();
      return r.json();
    },
    refetchInterval: 60_000,
  });
  // The latest route returns an attestation object when Lantern has published,
  // or an honest pending shape otherwise. Treat a present root as live.
  const root = data?.root ?? data?.merkleRoot ?? null;
  const live = Boolean(root);
  const label = isLoading ? 'checking…' : live ? 'latest attestation on-chain' : 'no attestation yet';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-parchment px-3 py-1 text-[11px] uppercase tracking-wider text-muted">
      <span className={'size-1.5 rounded-full ' + (isLoading ? 'bg-divider' : live ? 'bg-live' : 'bg-testnet')} aria-hidden />
      Lantern · {label}
    </span>
  );
}

interface Cta {
  label: string;
  href: string;
}

function IntegrationCard({
  eyebrow,
  title,
  body,
  signal,
  ctas,
}: {
  eyebrow: string;
  title: string;
  body: string;
  signal?: React.ReactNode;
  ctas: Cta[];
}) {
  return (
    <article className="flex flex-col rounded-md border border-divider bg-parchment p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{eyebrow}</p>
        {signal}
      </div>
      <h2 className="mt-2 font-display text-2xl text-ink">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-ink-soft">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ctas.map((c, i) => (
          <Link
            key={c.href}
            href={c.href as Route}
            className={
              'inline-flex min-h-[40px] items-center rounded-md px-4 py-2 text-sm font-medium ' +
              (i === 0
                ? 'bg-ink text-parchment hover:bg-ink/90'
                : 'border border-divider bg-parchment-light text-ink hover:border-ink/30')
            }
          >
            {c.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

export function IntegrationsView() {
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <IntegrationCard
        eyebrow="Data API · Codex"
        title="Read margin, risk, and venue data"
        body="Pay-per-call market and risk data over x402 - the same feeds the agents read. Eight endpoints: margin, positions, risk, venues, agent performance, backtests, attestations, options."
        signal={<CodexLiveStatus />}
        ctas={[
          { label: 'API reference', href: '/docs/api' },
          { label: 'Glossary', href: '/docs/glossary' },
        ]}
      />
      <IntegrationCard
        eyebrow="Delegation · Sigil"
        title="Let an agent trade within limits you sign"
        body="Issue an EIP-712 mandate scoped to one agent and strategy, with a per-action cap, a daily count, an expiry, and a venue allowlist the agent cannot exceed. Revoke any time, or kill all at once."
        ctas={[
          { label: 'Delegate to an agent', href: '/app/agents' },
          { label: 'Session keys', href: '/app/settings/session-keys' },
        ]}
      />
      <IntegrationCard
        eyebrow="Proof of reserves · Lantern"
        title="Verify any balance against the chain"
        body="Lantern publishes a signed Merkle attestation of the vault on-chain. Generate an inclusion proof for your balance in seconds, in the browser, without trusting Atrium."
        signal={<ReservesSignal />}
        ctas={[
          { label: 'Verify reserves', href: '/app/reserves' },
          { label: 'How it works', href: '/docs/honesty' },
        ]}
      />
      <IntegrationCard
        eyebrow="Venue adapters · Portico"
        title="Add a venue to the cross-margin set"
        body="Adapters implement the open IPorticoAdapter standard (MIT-licensed). Whitelisted by 3-reviewer Curator approval behind a 48h timelock. A Curator grant of $5K ARB will ship per accepted adapter after testnet launch."
        ctas={[
          { label: 'Adapter spec', href: '/learn#adapters' },
          { label: 'Decisions (ADR-008)', href: '/docs/adr/008' },
        ]}
      />
    </div>
  );
}
