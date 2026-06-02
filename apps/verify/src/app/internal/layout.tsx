import { buildMetadata } from '@/lib/build-metadata';

/**
 * All /internal/* routes are operational dashboards, never public surface. This
 * layout ships a noindex,nofollow meta tag for the whole subtree (the child
 * pages are client components and cannot export metadata themselves). Defense in
 * depth beyond the robots.txt disallow, which crawlers may ignore and which does
 * nothing against a judge/scraper typing the URL.
 */
export const metadata = buildMetadata({
  title: 'Internal',
  description: 'Atrium internal operations.',
  canonical: '/internal',
  noindex: true,
});

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
