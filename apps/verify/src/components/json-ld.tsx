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
  url: 'https://verify.useatrium.me',
  sameAs: [
    'https://github.com/atrium-labs',
    'https://twitter.com/atriumfi',
  ],
};

/** SoftwareApplication schema for the landing page. */
export const ATRIUM_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Atrium',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Cross-venue portfolio margin for the EVM.',
  url: 'https://verify.useatrium.me',
};
