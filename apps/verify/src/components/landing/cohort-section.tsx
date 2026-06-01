'use client';

import { useQuery } from '@tanstack/react-query';
import { SectionShell } from './section-shell';

interface CohortLite {
  partners: Array<{ id: string; name: string }>;
  source: 'scribe' | 'pending';
}

async function fetchCohort(): Promise<CohortLite> {
  try {
    const r = await fetch('/api/cohort/partners');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { partners: [], source: 'pending' };
  }
}

export function CohortSection() {
  const { data } = useQuery({ queryKey: ['cohort-lite'], queryFn: fetchCohort, refetchInterval: 5 * 60_000 });
  return (
    <SectionShell
      id="network"
      eyebrow="Built with"
      headline="Venue and infrastructure partners across the EVM stack, shipping with us from day one."
      sub="The cohort grows as partners sign onboarding LOIs. Today the page shows the live signed count from Scribe, never an inflated number."
    >
      {(!data || data.partners.length === 0) ? (
        <div className="mx-auto max-w-xl rounded-md border border-divider bg-parchment-soft/40 p-8 text-center">
          <p className="text-sm text-ink-soft">No partners signed yet.</p>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
            Outreach in progress · count auto-populates from Scribe
          </p>
        </div>
      ) : (
        <ul className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 md:grid-cols-4">
          {data.partners.map((p) => (
            <li key={p.id} className="rounded-md border border-divider bg-parchment p-4 text-center text-sm text-ink-soft">
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
