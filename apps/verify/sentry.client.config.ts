// Sentry browser-side init — Phase 3 hardened.
// Gated on user consent; scrubs wallet addresses from all telemetry.
import * as Sentry from '@sentry/nextjs';
import { hasConsent } from './src/lib/consent';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Scrub 0x-prefixed hex addresses/hashes from a string. */
function scrubPii(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(/0x[0-9a-fA-F]{64}/g, '0x[HASH-REDACTED]')
    .replace(/0x[0-9a-fA-F]{40}/g, '0x[REDACTED]');
}

if (dsn && hasConsent('analytics')) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 0.5,
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    initialScope: {
      tags: {
        chain_id: process.env.NEXT_PUBLIC_CHAIN_ID ?? '421614',
        route_kind: 'browser',
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
      // Phase 12: add wallet_truncated_first_4 tag from localStorage
      try {
        const wallet = typeof window !== 'undefined'
          ? localStorage.getItem('atrium_connected_wallet')
          : null;
        if (wallet) {
          event.tags = { ...event.tags, wallet_truncated_first_4: wallet.slice(0, 6) };
        }
      } catch { /* noop */ }
      return event;
    },
  });
}
