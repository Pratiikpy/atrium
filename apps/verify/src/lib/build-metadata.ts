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
  };
}
