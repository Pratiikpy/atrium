// Next.js 15 instrumentation hook — fires once per server runtime start.
// We use it to register Sentry for the right runtime (Node or Edge) and
// to capture nested-request errors via onRequestError.
//
// Client-side init lives in instrumentation-client.ts (Next.js convention).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
