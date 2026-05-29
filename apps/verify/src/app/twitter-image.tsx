// Phase theta.7 (2026-05-25): same OG image works as a Twitter
// summary_large_image card. Next.js automatically wires the route as
// twitter:image when this file exists alongside opengraph-image.tsx.
//
// Per-page override is allowed by placing a per-route opengraph-image
// file (e.g. apps/verify/src/app/security/opengraph-image.tsx).
export { default, alt, size, contentType } from './opengraph-image';
export const runtime = 'edge';
