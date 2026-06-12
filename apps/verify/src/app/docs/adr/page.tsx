import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { ADRS } from '@/lib/adrs';

export const metadata = {
  title: 'Architecture Decision Records',
  description: 'ADR-001 through ADR-012: every consequential design decision, with context and alternatives.',
  alternates: { canonical: '/docs/adr' },
};

export default function AdrIndexPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Architecture decisions</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Every consequential design decision is recorded as an ADR with its context, the decision,
            the alternatives we rejected, and the consequences. These are the forks that shaped
            Atrium, written down so the reasoning outlives the people who made it.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {ADRS.map((a) => (
            <Link key={a.id} href={`/docs/adr/${a.id}`} className="block">
              <Card className="h-full transition-colors hover:border-accent/40">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted">ADR-{a.id}</span>
                  {a.date && <span className="font-mono text-[10px] text-muted">{a.date}</span>}
                </div>
                <p className="mt-2 font-display text-lg leading-snug text-ink">{a.title}</p>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </MarketingShell>
  );
}
