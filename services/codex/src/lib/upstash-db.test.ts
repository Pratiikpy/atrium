import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maybeUpstashDB } from './upstash-db';

/**
 * Phase theta.2 fix verification. Pre-fix the Vercel Codex deploy used
 * inMemoryDB — per-instance state lost on every cold start, which
 * silently disabled x402 replay-dedup + Idempotency-Key dedup. The
 * Upstash shim restores both guarantees by routing the same D1-shaped
 * SQL through Upstash Redis REST.
 *
 * These tests pin the shim's interpretation of each SQL pattern the
 * Codex routes issue. fetch() is mocked per-test so the Upstash REST
 * protocol shape (POST with JSON array body, Bearer auth) is asserted
 * end-to-end.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

const ENV = {
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token-' + 'x'.repeat(40),
};

function mockUpstash(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ result }),
  });
}

describe('maybeUpstashDB — configuration gate', () => {
  it('returns null when URL is missing', () => {
    expect(maybeUpstashDB({ UPSTASH_REDIS_REST_TOKEN: 'x' })).toBeNull();
  });
  it('returns null when token is missing', () => {
    expect(maybeUpstashDB({ UPSTASH_REDIS_REST_URL: 'https://x' })).toBeNull();
  });
  it('returns null when both are missing', () => {
    expect(maybeUpstashDB({})).toBeNull();
  });
  it('returns a D1-shaped handle when both are set', () => {
    const db = maybeUpstashDB(ENV);
    expect(db).not.toBeNull();
    expect(typeof db?.prepare).toBe('function');
  });
});

describe('UpstashDB — payments replay-dedup', () => {
  const db = maybeUpstashDB(ENV)!;

  it('SELECT by tx_hash → GET payments:tx:<lower_hash>', async () => {
    mockUpstash(JSON.stringify({ id: 'p1', tx_hash: '0xabc' }));
    const row = await db
      .prepare('SELECT * FROM payments WHERE tx_hash = ?')
      .bind('0xAbC')
      .first();
    expect(row).toEqual({ id: 'p1', tx_hash: '0xabc' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENV.UPSTASH_REDIS_REST_URL);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}`);
    expect(JSON.parse(init.body)).toEqual(['GET', 'payments:tx:0xabc']);
  });

  it('SELECT by tx_hash returns null on miss', async () => {
    mockUpstash(null);
    const row = await db
      .prepare('SELECT * FROM payments WHERE tx_hash = ?')
      .bind('0xdead')
      .first();
    expect(row).toBeNull();
  });

  it('INSERT payment uses SETNX for replay protection', async () => {
    mockUpstash(1); // SETNX acquired
    mockUpstash('OK'); // payments:id:<id> SET
    const result = await db
      .prepare('INSERT INTO payments (...) VALUES (?,?,?,?,?,?,?)')
      .bind('p1', '0xwallet', '/margin', '1000', '0xabc', null, 1700000000)
      .run();
    expect(result.success).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toBe('SETNX');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[1]).toBe('payments:tx:0xabc');
  });

  it('INSERT payment fails when SETNX returns 0 (replay detected)', async () => {
    mockUpstash(0); // duplicate tx_hash
    const result = await db
      .prepare('INSERT INTO payments (...) VALUES (?,?,?,?,?,?,?)')
      .bind('p2', '0xwallet', '/margin', '1000', '0xabc', null, 1700000000)
      .run();
    expect(result.success).toBe(false);
  });
});

describe('UpstashDB — idempotency cache with TTL', () => {
  const db = maybeUpstashDB(ENV)!;

  it('SELECT from idempotency_cache → GET idem:<key>', async () => {
    mockUpstash(JSON.stringify({ body: '{"ok":true}', status: 200 }));
    const row = await db
      .prepare('SELECT body, status FROM idempotency_cache WHERE key = ? AND ...')
      .bind('idem-key', Date.now())
      .first();
    expect(row).toEqual({ body: '{"ok":true}', status: 200 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(['GET', 'idem:idem-key']);
  });

  it('INSERT idempotency_cache uses SET EX with TTL in seconds', async () => {
    mockUpstash('OK');
    const now = Date.now();
    const expires = now + 60_000; // 60 sec
    await db
      .prepare('INSERT OR REPLACE INTO idempotency_cache (...) VALUES (?,?,?,?)')
      .bind('idem-key', '{"ok":true}', 200, expires)
      .run();
    const cmd = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cmd[0]).toBe('SET');
    expect(cmd[1]).toBe('idem:idem-key');
    expect(cmd[3]).toBe('EX');
    // TTL should be ~60s. Allow ±2s for clock drift in the test.
    expect(cmd[4]).toBeGreaterThanOrEqual(58);
    expect(cmd[4]).toBeLessThanOrEqual(62);
  });

  it('DELETE expired idempotency_cache is a no-op (TTL handled by Redis)', async () => {
    const result = await db
      .prepare('DELETE FROM idempotency_cache WHERE expires_ms < ?')
      .bind(Date.now())
      .run();
    expect(result.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // No upstream call needed
  });
});

describe('UpstashDB — backtest enumeration', () => {
  const db = maybeUpstashDB(ENV)!;

  it('all() on backtests uses SMEMBERS + MGET', async () => {
    mockUpstash(['bt1', 'bt2']); // SMEMBERS
    mockUpstash([JSON.stringify({ id: 'bt1' }), JSON.stringify({ id: 'bt2' })]); // MGET
    const { results } = await db.prepare('SELECT * FROM backtest_jobs').all();
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 'bt1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(['SMEMBERS', 'bt-index']);
  });

  it('all() returns empty when SMEMBERS is empty', async () => {
    mockUpstash([]); // empty backtest index
    const { results } = await db.prepare('SELECT * FROM backtest_jobs').all();
    expect(results).toEqual([]);
  });
});

describe('UpstashDB — error handling', () => {
  const db = maybeUpstashDB(ENV)!;

  it('throws when Upstash returns non-OK status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(
      db.prepare('SELECT * FROM payments WHERE tx_hash = ?').bind('0xabc').first(),
    ).rejects.toThrow(/upstash_500/);
  });

  it('throws when Upstash returns error field', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'WRONGTYPE' }) });
    await expect(
      db.prepare('SELECT * FROM payments WHERE tx_hash = ?').bind('0xabc').first(),
    ).rejects.toThrow(/WRONGTYPE/);
  });
});
