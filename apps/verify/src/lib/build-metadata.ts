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
  return {
    title: o.title,
    description: o.description,
    openGraph: {
      title: `${o.title} · Atrium`,
      description: o.description,
      ...(o.ogImage && { images: [{ url: o.ogImage }] }),
    },
    alternates: { canonical: o.canonical },
    ...(o.noindex && { robots: { index: false, follow: false } }),
  };
}
