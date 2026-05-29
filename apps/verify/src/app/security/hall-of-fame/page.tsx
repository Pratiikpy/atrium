import Link from 'next/link';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Security Hall of Fame',
  description: 'Researchers who have responsibly disclosed vulnerabilities to Atrium.',
};

export default function HallOfFamePage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Hall of Fame</h1>
          <p className="mt-2">
            Researchers who responsibly disclose vulnerabilities are credited here with their
            permission.
          </p>
        </header>

        <div className="rounded-md border border-divider bg-parchment p-8 text-center">
          <p className="text-muted">No disclosures published yet.</p>
          <p className="mt-2 text-sm text-muted">
            Found something? Report to{' '}
            <a href="mailto:security@atrium.fi" className="underline">security@atrium.fi</a>.
            See <Link href="/security/bounty" className="underline">bounty scope</Link>.
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
