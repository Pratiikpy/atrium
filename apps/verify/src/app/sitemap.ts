import type { MetadataRoute } from 'next';

/**
 * sitemap.xml, every public-facing URL. Excludes /app/* (wallet-gated),
 * /api/* (server endpoints), /monitoring (Sentry tunnel).
 *
 * SEO-04: Added /docs/honesty, /docs/api, /team, /security, /changelog,
 * /manifesto, /learn to ensure completeness.
 * SEO-05: Added the rest of the docs sub-tree (/docs/runbooks, /docs/glossary,
 * /docs/deployment, /docs/adr + the 12 ADR records), the /verify overview,
 * /legal/kyc, /legal/sub-processors, /press, /accessibility, /security/bounty.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://useatrium.me');

  const lastModified = new Date();

  const publicRoutes = [
    '',
    '/architecture',
    '/getting-started',
    '/pitch',
    '/docs',
    '/docs/honesty',
    '/docs/api',
    '/docs/runbooks',
    '/docs/glossary',
    '/docs/deployment',
    '/docs/adr',
    '/security',
    '/security/bounty',
    '/brand',
    '/learn',
    '/manifesto',
    '/team',
    '/cohort',
    '/lantern',
    '/sla',
    '/changelog',
    '/verify',
    '/agents/marketplace',
    '/rostrum',
    '/benchmarks',
    '/press',
    '/accessibility',
    '/legal/privacy',
    '/legal/terms',
    '/legal/kyc',
    '/legal/sub-processors',
  ];

  // The 7-step Verifier walk, explicit so each step is indexable.
  const verifierSteps = [1, 2, 3, 4, 5, 6, 7].map((n) => `/verify/${n}`);

  // The 12 ADR decision records, explicit so each is indexable.
  const adrPages = [
    '001',
    '002',
    '003',
    '004',
    '005',
    '006',
    '007',
    '008',
    '009',
    '010',
    '011',
    '012',
  ].map((n) => `/docs/adr/${n}`);

  return [...publicRoutes, ...verifierSteps, ...adrPages].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1.0 : path.startsWith('/verify') ? 0.8 : 0.6,
  }));
}
