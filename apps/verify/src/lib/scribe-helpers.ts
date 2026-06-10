/**
 * Shared GraphQL helpers. Server-callable (no 'use client'); the hook
 * version lives in lib/scribe.ts.
 */
export interface CohortPartner {
  id: string;
  displayName: string | null;
  joinedAtTimestamp: string;
  totalDepositsWei: string;
  totalTradesCount: string;
  lastActionTimestamp: string;
}

// Iteration 41 audit fix: pre-fix the fallback URL was a literal containing
// `PLACEHOLDER` in the path. If `NEXT_PUBLIC_SCRIBE_URL` was unset (forgot
// in deploy env, .env.local missed in dev), every gql() call would 404,
// the route catches would render "pending," and the operator had no signal
// that the env wasn't configured. Silent operational failure during demo
// rehearsal or judge-day setup.
//
// Now: detect the placeholder at the gql() call boundary and surface it as
// a structured `ScribeNotConfigured` error. The error path is the same
// shape as other gql failures, so the catch-blocks across routes still
// render "pending", but the error message names the missing env so it's
// visible in server logs and any boundary surfacing err.message gets a
// useful hint. Env read is per-call (not module-load) so test environments
// can set the env in beforeEach without re-importing.
const PLACEHOLDER_FALLBACK = 'https://api.studio.thegraph.com/query/PLACEHOLDER/atrium/version/latest';

function resolveScribeUrl(): string {
  // Server-only SCRIBE_URL wins: the self-hosted graph-node is a plain-http
  // droplet endpoint the browser must never call directly (mixed content +
  // CSP). Next only inlines NEXT_PUBLIC_* into the client bundle, so this
  // branch is server-exclusive; NEXT_PUBLIC_SCRIBE_URL stays as the legacy
  // fallback. Browser surfaces read Scribe through /api proxies only.
  return process.env.SCRIBE_URL ?? process.env.NEXT_PUBLIC_SCRIBE_URL ?? PLACEHOLDER_FALLBACK;
}

export class ScribeNotConfigured extends Error {
  constructor() {
    super(
      'Neither SCRIBE_URL nor NEXT_PUBLIC_SCRIBE_URL is set; gql calls will fail. ' +
        'See `apps/verify/src/lib/scribe-helpers.ts` for the config requirement.',
    );
    this.name = 'ScribeNotConfigured';
  }
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const scribeUrl = resolveScribeUrl();
  // Fail-loud guard for the iteration-41 audit: don't even attempt the
  // fetch against the PLACEHOLDER URL, the request would 404 silently and
  // the operator wouldn't know why. Throwing here lands in the route's
  // catch block where it's logged + surfaced as "scribe unavailable" with
  // the config-gap reason instead of a generic network error.
  if (scribeUrl === PLACEHOLDER_FALLBACK) {
    throw new ScribeNotConfigured();
  }
  // Audit P-7 fix: 3-second timeout. Without this, a slow Scribe stacks
  // hanging requests across every /api/* route that uses gql, especially
  // under TanStack Query's 30s refetchInterval × 5+ surfaces.
  const r = await fetch(scribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error(`Scribe ${r.status}`);
  const json = (await r.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error('empty');
  return json.data;
}
