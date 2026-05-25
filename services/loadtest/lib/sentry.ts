/**
 * Sentry shim for k6 loadtest helper scripts. Phase theta.6 (2026-05-25).
 * The k6 runtime itself can't import this (k6 has a custom JS runtime);
 * the surrounding Node.js orchestration in services/loadtest/scripts/
 * uses this to surface metric-publishing failures.
 */

let sentryInitialised = false;

interface SentryLike {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage: (msg: string, ctx?: Record<string, unknown>) => void;
}

let sentry: SentryLike | null = null;

export async function initSentry(): Promise<void> {
  if (sentryInitialised) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const mod = await import('@sentry/node');
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
    });
    sentry = mod as unknown as SentryLike;
    sentryInitialised = true;
  } catch {
    // optional dep missing.
  }
}

export function captureLoadtestError(err: unknown, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(err, { tags: { service: 'loadtest' }, extra: ctx });
  } else {
    console.error('[loadtest]', err, ctx);
  }
}
