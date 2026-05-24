import type { MetadataRoute } from 'next';

/**
 * sitemap.xml — every public-facing URL. Excludes /app/* (wallet-gated),
 * /api/* (server endpoints), /monitoring (Sentry tunnel).
 *
 * Keep this list in sync with the routes in apps/verify/src/app/. When
 * we add a new public page, add a row here so search engines + judges
 * can find it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://atrium.fi');

  const lastModified = new Date();

  // Public routes that visitors can land on directly.
  const publicRoutes = [
    '',
    '/docs',
    '/security',
    '/brand',
    '/learn',
    '/manifesto',
    '/team',
    '/cohort',
    '/lantern',
    '/lantern/sla',
    '/changelog',
    '/agents/marketplace',
    '/rostrum',
    '/benchmarks',
    '/legal/privacy',
    '/legal/terms',
  ];

  // The 7-step Verifier walk — explicit so each step is indexable.
  const verifierSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => `/verify/${n}`);

  return [...publicRoutes, ...verifierSteps].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1.0 : path.startsWith('/verify') ? 0.8 : 0.6,
  }));
}
