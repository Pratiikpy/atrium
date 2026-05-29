import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { getRunbook, getRunbooks } from '@/lib/runbooks';
import { renderMarkdownToHtml } from '@/lib/markdown';

export function generateStaticParams() {
  return getRunbooks().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rb = getRunbook(slug);
  return {
    title: rb ? `Atrium · ${rb.title}` : 'Atrium · Runbook',
    description: rb?.summary || 'Operational runbook.',
  };
}

export default async function RunbookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rb = getRunbook(slug);
  if (!rb) notFound();

  const html = renderMarkdownToHtml(rb.markdown);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl">
        <Link href="/docs/runbooks" className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          ← All runbooks
        </Link>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-muted">{rb.category}</p>

        {/* Rendered from the committed runbooks/<slug>.md via the tested,
            dependency-free markdown renderer. Source is trusted repo content;
            text is HTML-escaped and link schemes are validated in the renderer. */}
        <article dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-12 border-t border-divider pt-6">
          <a
            href={`https://github.com/Pratiikpy/atrium/blob/main/runbooks/${rb.slug}.md`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            View source on GitHub ↗
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
