/**
 * Sentry shim for reference agents (Vercel Edge). Phase theta.6 (2026-05-25).
 * Mirrors services/vigil-keeper/src/lib/sentry.ts. DSN-or-no-op.
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
    // Browser SDK works under Vercel Edge runtime; @sentry/node has
    // perf_hooks that fail there. Optional dep, see same pattern in
    // services/codex/src/lib/sentry.ts.
    const sentryPackage: string = '@sentry/browser';
    const mod = await import(/* @vite-ignore */ sentryPackage);
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
    // optional dependency missing; honest no-op.
  }
}

export function captureAgentError(
  err: unknown,
  agent: 'augur' | 'haruspex' | 'auspex',
  ctx?: Record<string, unknown>,
): void {
  if (sentry) {
    sentry.captureException(err, { tags: { service: 'agents', agent }, extra: ctx });
  } else {
    console.error('[agents/' + agent + ']', err, ctx);
  }
}

export function captureAgentEvent(
  msg: string,
  agent: 'augur' | 'haruspex' | 'auspex',
  ctx?: Record<string, unknown>,
): void {
  if (sentry) {
    sentry.captureMessage(msg, { tags: { service: 'agents', agent }, extra: ctx });
  } else {
    console.log('[agents/' + agent + ']', msg, ctx);
  }
}
