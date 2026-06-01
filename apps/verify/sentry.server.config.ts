// Sentry Node.js (server-side) init, Phase 3 hardened.
// No consent gate needed server-side; applies PII scrub for wallet addresses.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

function scrubPii(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(/0x[0-9a-fA-F]{64}/g, '0x[HASH-REDACTED]')
    .replace(/0x[0-9a-fA-F]{40}/g, '0x[REDACTED]');
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    initialScope: {
      tags: {
        chain_id: process.env.NEXT_PUBLIC_CHAIN_ID ?? '421614',
        route_kind: 'server',
      },
    },
    beforeSend(event) {
      if (event.message) event.message = scrubPii(event.message);
      if (event.request?.url) event.request.url = scrubPii(event.request.url)!;
      if (event.request?.query_string) {
        event.request.query_string = scrubPii(
          typeof event.request.query_string === 'string'
            ? event.request.query_string
            : undefined,
        );
      }
      if (event.breadcrumbs) {
        for (const bc of event.breadcrumbs) {
          if (bc.message) bc.message = scrubPii(bc.message);
          if (bc.data?.url) bc.data.url = scrubPii(bc.data.url as string);
        }
      }
      return event;
    },
  });
}
