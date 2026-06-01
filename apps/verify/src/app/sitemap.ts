import type { MetadataRoute } from 'next';

/**
 * sitemap.xml, every public-facing URL. Excludes /app/* (wallet-gated),
 * /api/* (server endpoints), /monitoring (Sentry tunnel).
 *
 * SEO-04: Added /docs/honesty, /docs/api, /team, /security, /changelog,
 * /manifesto, /learn to ensure completeness.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://atrium.fi');

  const lastModified = new Date();

  const publicRoutes = [
    '',
    '/docs',
    '/docs/honesty',
    '/docs/api',
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

  // The 7-step Verifier walk, explicit so each step is indexable.
  const verifierSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => `/verify/${n}`);

  return [...publicRoutes, ...verifierSteps].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1.0 : path.startsWith('/verify') ? 0.8 : 0.6,
  }));
}
