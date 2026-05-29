import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { getRunbooks, getRunbooksByCategory } from '@/lib/runbooks';

export const metadata = {
  title: 'Atrium · Runbooks',
  description: 'Operational runbooks: incident response, deploy, keys, monitoring, setup.',
};

export default function RunbooksIndexPage() {
  const groups = getRunbooksByCategory();
  const total = getRunbooks().length;

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Runbooks</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            The operational playbooks Atrium runs on: what to do when a keeper stalls, how a deploy
            goes out, how keys rotate, who is on call. {total} runbooks, rendered from the
            <code className="mx-1 font-mono text-ink">runbooks/</code> markdown that ships in the
            repo. Each one is the same procedure an on-call engineer follows.
          </p>
        </section>

        {groups.map((g) => (
          <section key={g.category} className="mt-12">
            <h2 className="font-display text-2xl text-ink">{g.category}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {g.items.map((r) => (
                <Link key={r.slug} href={`/docs/runbooks/${r.slug}`} className="block">
                  <Card className="h-full transition-colors hover:border-accent/40">
                    <p className="font-display text-lg text-ink">{r.title}</p>
                    {r.summary && <p className="mt-2 text-sm text-ink-soft">{r.summary}</p>}
                    <p className="mt-3 font-mono text-xs text-muted">{r.slug}.md</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingShell>
  );
}
