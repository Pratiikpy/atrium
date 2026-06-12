import Link from 'next/link';
import { Card } from '@/components/ui';
import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Press',
  description: 'Brand assets, boilerplate, and press contacts for Atrium.',
  alternates: { canonical: '/press' },
};

export default function PressPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
        <section>
          <h1 className="font-display text-5xl text-ink">Press</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            Brand assets, boilerplate copy, and contact information for journalists
            and content creators covering Atrium.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Boilerplate</h2>
          <p className="mt-4 text-sm text-ink-soft">
            Atrium is a cross-venue portfolio margin protocol on Arbitrum. One wallet
            posts collateral once and trades across multiple on-chain venues with a
            single margin number. The protocol uses SPAN-style risk scenarios, formal
            verification via Kani, and, for upgrades, a single deployer-key admin on testnet today (with a 48-hour timelocked 3-of-5 multisig as the mainnet target).
            Currently deployed on Arbitrum Sepolia testnet.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Brand assets</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <p className="font-display text-lg text-ink">Logo + wordmark</p>
              <p className="mt-2 text-sm text-ink-soft">
                SVG and PNG formats in light and dark variants.
              </p>
              <Link href="/brand" className="mt-3 inline-block text-xs text-ink underline-offset-2 hover:underline">
                View brand page →
              </Link>
            </Card>
            <Card>
              <p className="font-display text-lg text-ink">Download all</p>
              <p className="mt-2 text-sm text-ink-soft">
                ZIP archive of all brand assets (logos, colors, typography samples).
              </p>
              {/* Bug-hunt fix (2026-06-02): the .zip CTA was a live `download`
                  link to /press/atrium-press-kit.zip, which does not exist (404
                  on click). The same assets are live on the brand kit, so point
                  there with an honest "packaging" note instead of a dead download. */}
              <p className="mt-3 text-xs text-muted">
                Packaged .zip pending. Browse every asset on the{' '}
                <a href="/brand" className="text-ink underline-offset-2 hover:underline">brand kit</a>.
              </p>
            </Card>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Logo guidelines</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>Maintain clear space equal to the height of the &ldquo;A&rdquo; glyph around the logo.</li>
            <li>Do not stretch, rotate, or recolor the logo.</li>
            <li>Use the dark variant on light backgrounds and the light variant on dark backgrounds.</li>
            <li>Minimum size: 24px height for digital, 10mm for print.</li>
          </ul>
          <Link href="/brand" className="mt-4 inline-block text-xs text-ink underline-offset-2 hover:underline">
            Full brand guidelines →
          </Link>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Contact</h2>
          <p className="mt-4 text-sm text-ink-soft">
            Press inquiries: <code className="font-mono text-ink">press@useatrium.me</code>
          </p>
          <p className="mt-2 text-xs text-muted">
            We&rsquo;re testnet-stage, so email replies may take a little longer. For anything
            time-sensitive, the security contact on{' '}
            <a href="/security" className="underline hover:text-ink">/security</a> is monitored.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
