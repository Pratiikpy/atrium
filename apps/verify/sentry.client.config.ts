// Sentry browser-side init. Loaded by instrumentation-client.ts on every
// client render. The DSN itself is non-sensitive (it's an ingestion-only
// public identifier per Sentry docs), so NEXT_PUBLIC_ is intentional.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    // 10% performance traces by default — enough to spot regressions,
    // light enough on free-tier quota.
    tracesSampleRate: 0.1,
    // Capture session replays only on errors. Replay is a paid feature
    // beyond a quota — sample at 0 normally and 1.0 on error so the
    // student-pack tier (500 replays/month) is reserved for actual bugs.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Don't ship sourcemaps that include user wallet addresses; the
    // verify app already redacts on the server side.
    sendDefaultPii: false,
  });
}
