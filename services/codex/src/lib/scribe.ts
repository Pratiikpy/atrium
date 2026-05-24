/**
 * Minimal GraphQL client for Scribe (the Atrium subgraph).
 *
 * Codex handlers should never reach into chain RPC directly for read paths —
 * everything routes through Scribe so the user-facing API is consistent with
 * the dashboard reality (no race conditions between API and UI).
 *
 * Audit ZZZ-3 fix: pre-fix had no AbortSignal timeout. Matches the
 * verify-app `scribe-helpers.ts` P-7 fix — without a timeout, a slow
 * Scribe stacks hanging fetches across every /v1/* route that uses gql,
 * eating Worker isolate capacity even though Workers themselves auto-kill
 * at ~30s. Match the 3s budget set in the verify-app companion so the
 * two helpers behave identically for testnet load.
 *
 * Iteration 42 audit fix: pre-fix this trusted env.SCRIBE_URL blindly. With
 * the wrangler.toml default of "REPLACE_BEFORE_DEPLOY__..." (changed from
 * the PLACEHOLDER URL in the same iteration), `fetch()` would throw with a
 * cryptic "invalid URL" message. The route's catch turns that into a 503
 * with `scribe_unavailable` — but the underlying reason (config not set)
 * is buried in safeErrorDetail's redaction. Mirror the verify-app fix:
 * detect the placeholder pattern and throw a typed `ScribeNotConfigured`
 * error so the operator gets a precise "set SCRIBE_URL" signal.
 */
export interface GqlError {
  message: string;
}

const SCRIBE_TIMEOUT_MS = 3_000;
// Defense against both the iter-42 placeholder shape AND the old PLACEHOLDER
// URL in case an operator has a stale wrangler.toml from before iter 42.
const PLACEHOLDER_FRAGMENT = 'REPLACE_BEFORE_DEPLOY';
const OLD_PLACEHOLDER_FRAGMENT = '/query/PLACEHOLDER/';

export class ScribeNotConfigured extends Error {
  constructor(value: string) {
    super(
      `SCRIBE_URL is not configured (current value: ${value.slice(0, 40)}…). ` +
        'Set the SCRIBE_URL var in wrangler.toml or via `wrangler secret put` ' +
        'before deploying; see services/codex/wrangler.toml.',
    );
    this.name = 'ScribeNotConfigured';
  }
}

function isPlaceholder(url: string): boolean {
  return (
    !url ||
    url.includes(PLACEHOLDER_FRAGMENT) ||
    url.includes(OLD_PLACEHOLDER_FRAGMENT) ||
    !/^https?:\/\//.test(url)
  );
}

export async function gql<T>(env: { SCRIBE_URL: string }, query: string, variables?: Record<string, unknown>): Promise<T> {
  if (isPlaceholder(env.SCRIBE_URL)) {
    throw new ScribeNotConfigured(env.SCRIBE_URL ?? '');
  }
  const r = await fetch(env.SCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(SCRIBE_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Scribe ${r.status}`);
  const json = (await r.json()) as { data?: T; errors?: GqlError[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error('empty');
  return json.data;
}
