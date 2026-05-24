import type { MetadataRoute } from 'next';

/**
 * robots.txt — generated at build time. We allow indexing of everything
 * public (landing, docs, security, brand, learn, manifesto, team, cohort,
 * lantern, agents/marketplace, rostrum, benchmarks, changelog) and the
 * Verifier walk. We disallow /app/* since those routes require a wallet
 * and have no SEO value, plus /api/* which are internal endpoints.
 *
 * The /monitoring path is the Sentry tunnel route — also internal.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://atrium.fi';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/monitoring'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
