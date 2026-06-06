/**
 * SEO-03: Generic JSON-LD structured data component.
 * Renders a <script type="application/ld+json"> tag with the provided schema.
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** Organization schema for the landing page. */
export const ATRIUM_ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Atrium',
  url: 'https://useatrium.me',
  // Honesty audit (2026-06-05): removed the `sameAs` social profiles. They
  // pointed at github.com/atrium-labs + twitter.com/atriumfi, which are not
  // accounts we own; asserting them in structured data tells search engines
  // we control profiles we don't. Re-add only verified, owned accounts.
};

/** SoftwareApplication schema for the landing page. */
export const ATRIUM_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Atrium',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Cross-venue portfolio margin for the EVM.',
  url: 'https://useatrium.me',
};
