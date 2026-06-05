import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';
import { SUBSYSTEMS } from '@/lib/atrium/copy';

export const metadata = {
  title: 'Glossary',
  description: 'Every Atrium subsystem in plain English: what it is, and what it does for you.',
};

const ENTRIES = Object.values(SUBSYSTEMS);

/**
 * /docs/glossary: the plain-English key to the subsystem names.
 *
 * Atrium keeps its branded names (Plinth, Sigil, Lantern...) as identity per
 * the prototype contract; this page is where any of those names resolves to
 * "what it is + what it does for you". Single source: lib/atrium/copy.ts, so
 * the glossary can never drift from the labels used across the app.
 */
export default function GlossaryPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Glossary</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Atrium&apos;s subsystems carry short names: Plinth, Sigil, Lantern, and so on. Here is
            what each one is, in plain English, and what it does for you. The branded name is the
            identity; the plain label is what you see across the app.
          </p>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2">
          {ENTRIES.map((s) => (
            <Card key={s.brand} className="h-full">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-xl text-ink">{s.plain}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {s.brand}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{s.benefit}</p>
            </Card>
          ))}
        </section>

        <p className="mt-10 text-xs text-muted">
          {ENTRIES.length} subsystems. Names are product identity; definitions are sourced from
          <code className="ml-1 font-mono text-ink">lib/atrium/copy.ts</code>.
        </p>
      </div>
    </MarketingShell>
  );
}
