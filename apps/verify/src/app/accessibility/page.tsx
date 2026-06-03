import { MarketingShell } from '@/components/atrium/MarketingShell';

export const metadata = {
  title: 'Atrium · Accessibility',
  description: 'Accessibility statement, WCAG 2.1 AA compliance target.',
};

export default function AccessibilityPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl space-y-8 text-ink-soft">
        <header>
          <h1 className="font-display text-5xl text-ink">Accessibility Statement</h1>
          <p className="mt-2 text-sm italic text-muted">Last reviewed: 2026-05-28</p>
          <p className="mt-1 text-sm text-muted">
            Contact: <a href="mailto:accessibility@useatrium.me" className="underline">accessibility@useatrium.me</a>
          </p>
        </header>

        <section>
          <h2 className="font-display text-2xl text-ink">Compliance target</h2>
          <p className="mt-3">
            Atrium targets <strong>WCAG 2.1 Level AA</strong> conformance across all public-facing
            pages and the authenticated application.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">What we&apos;ve done</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Color contrast ratios meet or exceed 4.5:1 for normal text, 3:1 for large text.</li>
            <li>All interactive elements have visible <code className="font-mono text-ink">:focus-visible</code> outlines.</li>
            <li>Skip-to-content link on every page for keyboard navigation.</li>
            <li><code className="font-mono text-ink">prefers-reduced-motion</code> respected, animations disabled when requested.</li>
            <li>ARIA live regions wrap dynamic content (portfolio updates, toast notifications, transaction status).</li>
            <li>Semantic HTML structure (headings, landmarks, lists) throughout.</li>
            <li>Form inputs have associated labels; error messages are programmatically linked.</li>
            <li>Images and icons have appropriate alt text or <code className="font-mono text-ink">aria-hidden</code>.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Known gaps</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Keyboard arrow navigation in data tables (positions, activity feed), deferred from E2E-04/E2E-57.</li>
            <li>Complex chart components (margin engine visualization) lack full screen-reader descriptions.</li>
            <li>Mobile bottom navigation does not yet support swipe gestures for assistive tech.</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            These items are tracked and scheduled for resolution before mainnet launch.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Assessment methodology</h2>
          <p className="mt-3">
            This assessment was conducted internally per WCAG 2.1 AA criteria using axe-core
            automated testing and manual keyboard/screen-reader testing (NVDA, VoiceOver).
          </p>
          <p className="mt-2">
            An independent third-party accessibility audit is scheduled for mainnet readiness.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">European Accessibility Act</h2>
          <p className="mt-3">
            Atrium serves EU users and is subject to the European Accessibility Act (2025).
            We are committed to meeting the Act&apos;s requirements for digital services.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Feedback</h2>
          <p className="mt-3">
            If you encounter an accessibility barrier, please contact{' '}
            <a href="mailto:accessibility@useatrium.me" className="underline">accessibility@useatrium.me</a>.
            We aim to respond within 5 business days and resolve issues within 30 days.
          </p>
        </section>
      </article>
    </MarketingShell>
  );
}
