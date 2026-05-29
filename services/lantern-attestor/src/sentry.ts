/**
 * Sentry shim for lantern-attestor (GHA cron now; Vercel api/cron until
 * Phase theta.3 migrated it). Same DSN-or-no-op contract as the other
 * service shims. Phase theta.6 (2026-05-25).
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
    // String-based dynamic import keeps tsc decoupled from @sentry/node's
    // types (matches services/codex/src/lib/sentry.ts). @sentry/node is a
    // declared dependency so it resolves at runtime in prod; if a deploy
    // strips it, the catch below is an honest no-op.
    const sentryPackage = '@sentry/node';
    const mod = await import(sentryPackage);
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
      beforeSend(event: { request?: { data?: unknown }; contexts?: { runtime?: unknown } }) {
        if (event.request?.data) delete event.request.data;
        if (event.contexts?.runtime) delete event.contexts.runtime;
        return event;
      },
    });
    sentry = mod as unknown as SentryLike;
    sentryInitialised = true;
  } catch {
    // @sentry/node not installed; honest no-op.
  }
}

export function captureLanternError(err: unknown, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(err, { tags: { service: 'lantern-attestor' }, extra: ctx });
  } else {
    console.error('[lantern-attestor]', err, ctx);
  }
}

export function captureLanternEvent(msg: string, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureMessage(msg, { tags: { service: 'lantern-attestor' }, extra: ctx });
  } else {
    console.log('[lantern-attestor]', msg, ctx);
  }
}
