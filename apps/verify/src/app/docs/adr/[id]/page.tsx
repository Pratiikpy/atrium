import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { ADRS, getAdr } from '@/lib/adrs';

export function generateStaticParams() {
  return ADRS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adr = getAdr(id);
  return {
    title: adr ? `Atrium · ADR-${adr.id}` : 'Atrium · ADR',
    description: adr?.title ?? 'Architecture decision record.',
  };
}

export default async function AdrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adr = getAdr(id);
  if (!adr) notFound();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl">
        <Link href="/docs/adr" className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          ← All decisions
        </Link>

        <div className="mt-6 flex items-baseline gap-3">
          <span className="font-mono text-sm text-muted">ADR-{adr.id}</span>
          {adr.date && <span className="font-mono text-xs text-muted">{adr.date}</span>}
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">{adr.title}</h1>

        <dl className="mt-8 space-y-6">
          {adr.sections.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{s.label}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </MarketingShell>
  );
}
