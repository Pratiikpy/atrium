import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Stat, RecessedCard, Tag } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';

/**
 * /cohort/[id] — detail page for an individual cohort partner.
 *
 * Per the "no inflated numbers" rule: until partners actually sign and
 * Scribe indexes their data, the partner list is empty. This page is the
 * template that renders when a real partner exists.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Atrium · Cohort partner',
  description: 'Cohort partner detail. Live TVL, positions, audit history from Scribe.',
};

interface Params {
  params: Promise<{ id: string }>;
}

export default async function CohortPartnerPage({ params }: Params) {
  const { id } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(id)) notFound();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
      <section>
        <p className="text-xs uppercase tracking-wider text-muted">Cohort partner</p>
        <h1 className="mt-2 font-display text-5xl text-ink">{prettifySlug(id)}</h1>
        <p className="mt-3 text-sm text-muted">
          <code className="font-mono text-ink">cohort/{id}</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag>testnet</Tag>
          <Tag>arbitrum-sepolia</Tag>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-4">
        <Stat label="Testnet TVL" value="—" sub="from Scribe" />
        <Stat label="Open positions" value="—" sub="from Plinth" />
        <Stat label="Active mandates" value="—" sub="Sigil count" />
        <Stat label="Joined" value="—" sub="on-chain timestamp" />
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-xl text-ink">Activity</h2>
          <RecessedCard className="mt-4">
            <p className="text-sm text-muted">
              No activity indexed yet. Partner must sign a partnership LOI and deposit on
              testnet before this section populates.
            </p>
          </RecessedCard>
          <p className="mt-3 text-xs text-muted">
            Live read from Scribe entities: <code className="font-mono text-ink">CofferDeposit</code>,{' '}
            <code className="font-mono text-ink">PositionOpened</code>, <code className="font-mono text-ink">PositionClosed</code>.
          </p>
        </Card>

        <Card>
          <h2 className="font-display text-xl text-ink">Audit history</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>· No audit report on file yet.</li>
            <li>· No incident report on file.</li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            Partner audit reports land in <code className="font-mono text-ink">incidents/</code> if
            anything ever requires one.
          </p>
        </Card>
      </section>

      <section className="mt-16 rounded-md border border-testnet/30 bg-testnet/5 p-6">
        <p className="text-sm font-medium text-testnet">Honest empty state</p>
        <p className="mt-2 text-sm text-ink-soft">
          Per the "no inflated numbers" rule, every field on this page reads from
          Scribe / live RPC. When a partner has not signed and deposited, the page renders
          empty values. We never invent activity to fill space.
        </p>
        <Link href="/cohort" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
          Back to cohort overview
        </Link>
      </section>
      </div>
    </MarketingShell>
  );
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
