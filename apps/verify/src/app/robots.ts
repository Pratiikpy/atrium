import type { MetadataRoute } from 'next';

/**
 * robots.txt — generated at build time.
 * SEO-05: Added /loadtest, /chaos, /monitoring to disallow.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://atrium.fi');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/monitoring', '/loadtest', '/chaos', '/internal', '/beta'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
