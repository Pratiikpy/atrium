import Link from 'next/link';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/wordmark';

/* SEO-K1: the 404 must carry exactly one robots directive: noindex. The root
   layout sets a global `index, follow`; the bug was that the not-found response
   shipped BOTH that and Next.js's own auto-injected noindex, a conflicting pair
   that reads as sloppy in view-source and can let crawlers index error pages.
   Setting robots: null here drops the layout's inherited `index, follow` from
   the resolved metadata, leaving Next.js's single built-in noindex as the only
   robots meta on the 404. (Setting robots to noindex instead would add a SECOND
   noindex tag alongside the framework's, so null is the correct override.) */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: null,
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <Wordmark size="hero" />
      <p className="mt-12 text-lg text-ink-soft">
        That page is not here. Maybe it was a step we have not built yet, or a link that drifted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90"
      >
        Back to Atrium
      </Link>
    </main>
  );
}
