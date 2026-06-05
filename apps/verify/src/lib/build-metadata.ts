import type { Metadata } from 'next';

/**
 * SEO-01: Shared metadata builder for per-page SEO.
 * Ensures consistent title template, canonical, and OG across all pages.
 */
export function buildMetadata(o: {
  title: string;
  description: string;
  ogImage?: string;
  canonical: string;
  /**
   * Internal/operational routes (chaos, loadtest, scribe-health, beta) set this
   * so a per-page noindex,nofollow meta tag ships, not just the advisory
   * robots.txt disallow. robots.txt is a request crawlers may ignore and does
   * nothing against a judge/scraper typing the URL; the meta tag is honored and
   * keeps these surfaces out of search and link previews.
   */
  noindex?: boolean;
}): Metadata {
  // Default to the dynamic OG card so every page ships an image on BOTH
  // OpenGraph and Twitter (M19: previously /cohort + /benchmarks shipped no OG
  // image, so Twitter leaked the file-convention default and the two networks
  // disagreed). M17: also emit twitter.title so a shared page shows its own
  // title, not the root "verify" fallback.
  const ogImage = o.ogImage ?? '/opengraph-image';
  const socialTitle = `${o.title} · Atrium`;
  return {
    title: o.title,
    description: o.description,
    openGraph: {
      title: socialTitle,
      description: o.description,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: o.description,
      images: [ogImage],
    },
    alternates: { canonical: o.canonical },
    ...(o.noindex && { robots: { index: false, follow: false } }),
  };
}
