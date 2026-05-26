/**
 * Sentry shim for Codex (Cloudflare Worker + Vercel Edge dual deploy).
 * Phase theta.6 (2026-05-25).
 *
 * Mirrors services/vigil-keeper/src/lib/sentry.ts. Initialises only
 * when SENTRY_DSN env is set; honest no-op otherwise so a missing
 * Sentry account never blocks the service from running. Wallet
 * addresses pass through (public on-chain identifiers needed for
 * triage); request bodies and runtime context are scrubbed before
 * send per docs/conventions/security.md.
 */

let sentryInitialised = false;

interface SentryLike {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage: (msg: string, ctx?: Record<string, unknown>) => void;
}

let sentry: SentryLike | null = null;

export async function initSentry(env: Record<string, string | undefined>): Promise<void> {
  if (sentryInitialised) return;
  const dsn = env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // Edge-compatible @sentry/browser is used because @sentry/node has
    // dependencies (perf_hooks, etc.) that fail under Cloudflare Workers
    // + Vercel Edge runtime. The Browser SDK works in both. The package
    // is an OPTIONAL dep — the deploy can choose whether to ship Sentry
    // by installing @sentry/browser; without it, this module is a no-op.
    // String-based dynamic import bypasses tsc's import-resolution check
    // so the codex package does not need @sentry/browser in its types.
    const sentryPackage: string = '@sentry/browser';
    const mod = await import(/* @vite-ignore */ sentryPackage);
    mod.init({
      dsn,
      environment: env.NODE_ENV ?? 'production',
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
    // @sentry/browser not installed; honest no-op.
  }
}

export function captureCodexError(err: unknown, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(err, { tags: { service: 'codex' }, extra: ctx });
  } else {
    console.error('[codex]', err, ctx);
  }
}

export function captureCodexEvent(msg: string, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureMessage(msg, { tags: { service: 'codex' }, extra: ctx });
  } else {
    console.log('[codex]', msg, ctx);
  }
}
