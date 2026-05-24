// Next.js 15 client-side instrumentation hook — fires once when the
// browser bundle boots. Re-exports Sentry init from sentry.client.config.ts
// so the file lives alongside its server / edge siblings.
import './sentry.client.config';
