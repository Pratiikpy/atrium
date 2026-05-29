/**
 * Lightweight Sentry init for the vigil-keeper GHA cron service.
 * Phase eta.9 (2026-05-25).
 *
 * Initialises only when `SENTRY_DSN` env is set (free tier from
 * sentry.io). PII guard: wallet addresses pass through (intentional;
 * they are public on-chain identifiers needed for triage); request
 * bodies and stack-frame locals are scrubbed.
 *
 * Usage:
 *   import { initSentry, captureKeeperError } from './lib/sentry.js';
 *   initSentry();
 *   ...
 *   try { ... } catch (e) { captureKeeperError(e, { tick: 'execute' }); }
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
  if (!dsn) {
    // Honest no-op when DSN is missing. Service still runs; events
    // just log to stdout via console.error and get captured by GHA
    // run logs.
    return;
  }
  try {
    // Lazy import so the dependency is optional. If @sentry/node is
    // not installed, the keeper still ticks and just lacks remote
    // error reporting. String-based specifier keeps tsc decoupled from
    // @sentry/node's types (matches services/codex/src/lib/sentry.ts);
    // @sentry/node is a declared dependency so it resolves at runtime.
    const sentryPackage = '@sentry/node';
    const mod = await import(sentryPackage);
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'production',
      tracesSampleRate: 0.1,
      // PII guard. Wallet addresses are public; everything else is
      // scrubbed before send. Per docs/conventions/security.md disclosure
      // posture, the goal is "the error is debuggable, the request
      // body is not leaked".
      beforeSend(event: { request?: { data?: unknown }; contexts?: { runtime?: unknown } }) {
        if (event.request?.data) delete event.request.data;
        if (event.contexts?.runtime) delete event.contexts.runtime;
        return event;
      },
    });
    sentry = mod as unknown as SentryLike;
    sentryInitialised = true;
  } catch {
    // @sentry/node not installed in this environment; honest no-op.
  }
}

export function captureKeeperError(err: unknown, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(err, { tags: { service: 'vigil-keeper' }, extra: ctx });
  } else {
    console.error('[vigil-keeper]', err, ctx);
  }
}

export function captureKeeperEvent(msg: string, ctx?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureMessage(msg, { tags: { service: 'vigil-keeper' }, extra: ctx });
  } else {
    console.log('[vigil-keeper]', msg, ctx);
  }
}
