import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { gql, ScribeNotConfigured } from './scribe';

/**
 * Iter 73 audit fix: pins the iter-42 placeholder-detection +
 * ZZZ-3 timeout contract on Codex's gql() helper. Sister to
 * apps/verify/src/lib/scribe-helpers which has its own copy of
 * the same iter-41 fix.
 *
 * - iter-42: detect both the new "REPLACE_BEFORE_DEPLOY" placeholder
 *   AND the old "/query/PLACEHOLDER/" wrangler.toml stale-fragment.
 *   Throw a typed ScribeNotConfigured error so operators get a
 *   precise "set SCRIBE_URL" signal instead of a buried fetch error.
 * - ZZZ-3: 3-second AbortSignal.timeout. Without it a slow Scribe
 *   stacks hanging fetches across every /v1/* Codex route, eating
 *   Worker isolate capacity.
 */

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Codex gql, iter-42 placeholder detection', () => {
  it('throws ScribeNotConfigured on the canonical placeholder string', async () => {
    const env = { SCRIBE_URL: 'REPLACE_BEFORE_DEPLOY__SET_SCRIBE_URL' };
    await expect(gql(env, 'query{}')).rejects.toBeInstanceOf(ScribeNotConfigured);
  });

  it('throws ScribeNotConfigured on the old PLACEHOLDER URL fragment (backward-compat)', async () => {
    // Stale wrangler.toml from before iter 42 still has the old shape.
    // Both fragments must trigger so an operator who didn't re-apply
    // the iter-42 wrangler edit still gets the same precise error.
    const env = { SCRIBE_URL: 'https://api.studio.thegraph.com/query/PLACEHOLDER/atrium/version/latest' };
    await expect(gql(env, 'query{}')).rejects.toBeInstanceOf(ScribeNotConfigured);
  });

  it('throws ScribeNotConfigured on empty URL', async () => {
    await expect(gql({ SCRIBE_URL: '' }, 'query{}')).rejects.toBeInstanceOf(ScribeNotConfigured);
  });

  it('throws ScribeNotConfigured on missing protocol (defensive shape check)', async () => {
    // Without `^https?://` the URL is malformed enough that fetch would
    // fail with a less-useful message. Better to refuse early.
    await expect(gql({ SCRIBE_URL: 'api.studio.thegraph.com/query/abc' }, 'query{}')).rejects.toBeInstanceOf(ScribeNotConfigured);
  });

  it('error message names SCRIBE_URL + first 40 chars of the bad value', async () => {
    const badUrl = 'REPLACE_BEFORE_DEPLOY__SET_SCRIBE_URL_or_else';
    try {
      await gql({ SCRIBE_URL: badUrl }, 'query{}');
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as ScribeNotConfigured;
      expect(e.name).toBe('ScribeNotConfigured');
      expect(e.message).toContain('SCRIBE_URL');
      expect(e.message).toContain(badUrl.slice(0, 40));
    }
  });

  it('accepts a real https URL through to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: 1 } }), { status: 200 }),
    );
    const env = { SCRIBE_URL: 'https://scribe.example.com/graphql' };
    const result = await gql<{ ok: number }>(env, 'query{}');
    expect(result).toEqual({ ok: 1 });
    fetchSpy.mockRestore();
  });
});

describe('Codex gql, request shape + ZZZ-3 timeout', () => {
  it('POSTs JSON body containing query + variables', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    const env = { SCRIBE_URL: 'https://scribe.example.com' };
    await gql(env, 'query Test { ok }', { foo: 'bar' });
    expect(capturedInit?.method).toBe('POST');
    expect((capturedInit?.headers as any)['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.query).toBe('query Test { ok }');
    expect(body.variables).toEqual({ foo: 'bar' });
    fetchSpy.mockRestore();
  });

  it('passes an AbortSignal with timeout (ZZZ-3)', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    await gql({ SCRIBE_URL: 'https://scribe.example.com' }, 'query{}');
    // The signal exists on every gql call. Without it slow Scribe
    // stacks hanging fetches.
    expect(capturedInit?.signal).toBeDefined();
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    fetchSpy.mockRestore();
  });
});

describe('Codex gql, response error handling', () => {
  it('throws "Scribe <status>" on non-2xx', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await expect(gql({ SCRIBE_URL: 'https://scribe.example.com' }, 'query{}')).rejects.toThrow(/Scribe 503/);
    fetchSpy.mockRestore();
  });

  it('throws on GraphQL error in body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'syntax error at line 5' }] }), { status: 200 }),
    );
    await expect(gql({ SCRIBE_URL: 'https://scribe.example.com' }, 'query{}')).rejects.toThrow(/syntax error at line 5/);
    fetchSpy.mockRestore();
  });

  it('throws "empty" when response has no data field', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(gql({ SCRIBE_URL: 'https://scribe.example.com' }, 'query{}')).rejects.toThrow(/empty/);
    fetchSpy.mockRestore();
  });

  it('returns parsed data on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { foo: 42 } }), { status: 200 }),
    );
    const r = await gql<{ foo: number }>({ SCRIBE_URL: 'https://scribe.example.com' }, 'query{}');
    expect(r).toEqual({ foo: 42 });
    fetchSpy.mockRestore();
  });
});
