import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pinTreeToIpfs } from './ipfs';
import { buildTree, type Leaf } from './merkle';

/**
 * Iter 74 audit fix: pins XXX-2 (30s timeout on web3.storage upload)
 * and XXX-3 (CID regex-validated before returning) on the Lantern
 * IPFS-pin path. Zero tests pinned these pre-iter-74.
 *
 * - XXX-2: pre-fix the hourly Lantern cron could hang forever on a
 *   slow web3.storage response, stalling subsequent publishes. 30s
 *   AbortSignal.timeout bounds the worst case.
 * - XXX-3: CID returned by web3.storage is regex-validated. A
 *   malformed CID reaching downstream consumers (subgraph → /api/
 *   lantern/verify-inclusion → IPFS gateway URL) would be SSRF
 *   surface — same shape as UUU-2 / R-1.
 * - Token-missing soft-fallback: if WEB3_STORAGE_TOKEN unset,
 *   returns '' and logs a warn rather than throwing. Lets the
 *   attestor's hourly cron survive without IPFS pinning during
 *   bootstrap.
 */

const ORIGINAL_TOKEN = process.env.WEB3_STORAGE_TOKEN;

function makeLeaf(seed: number): Leaf {
  return {
    user: `0x${seed.toString(16).padStart(40, '0')}` as `0x${string}`,
    balanceWei: BigInt(seed * 1000),
    salt: `0x${seed.toString(16).padStart(64, '0')}` as `0x${string}`,
  };
}

const validTree = () => buildTree([makeLeaf(1), makeLeaf(2), makeLeaf(3)]);

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.WEB3_STORAGE_TOKEN;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_TOKEN == null) delete process.env.WEB3_STORAGE_TOKEN;
  else process.env.WEB3_STORAGE_TOKEN = ORIGINAL_TOKEN;
});

describe('pinTreeToIpfs — token-missing soft fallback', () => {
  it('returns empty string + does NOT fetch when WEB3_STORAGE_TOKEN unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cid = await pinTreeToIpfs(validTree());
    expect(cid).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs a warning so operators see the unconfigured token', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await pinTreeToIpfs(validTree());
    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.mock.calls[0][0])).toContain('WEB3_STORAGE_TOKEN');
    warnSpy.mockRestore();
  });
});

describe('pinTreeToIpfs — XXX-3 CID validation', () => {
  it('returns the CID when web3.storage responds with a valid v0 CID', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    const validCidV0 = 'Qm' + 'a'.repeat(44);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cid: validCidV0 }), { status: 200 }),
    );
    const cid = await pinTreeToIpfs(validTree());
    expect(cid).toBe(validCidV0);
    fetchSpy.mockRestore();
  });

  it('accepts a valid v1 CID (b-prefix base32)', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    const validCidV1 = 'b' + 'a'.repeat(58);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cid: validCidV1 }), { status: 200 }),
    );
    const cid = await pinTreeToIpfs(validTree());
    expect(cid).toBe(validCidV1);
    fetchSpy.mockRestore();
  });

  it('throws on malformed CID (missing Qm prefix)', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cid: 'notacid' }), { status: 200 }),
    );
    await expect(pinTreeToIpfs(validTree())).rejects.toThrow(/malformed CID/);
    fetchSpy.mockRestore();
  });

  it('throws on non-string CID (defensive XXX-3)', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cid: 12345 }), { status: 200 }),
    );
    await expect(pinTreeToIpfs(validTree())).rejects.toThrow(/malformed CID/);
    fetchSpy.mockRestore();
  });

  it('throws on CID containing path-injection characters', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    // SSRF surface: a CID containing slashes would interpolate into
    // gateway URLs as extra path segments.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ cid: 'Qm' + 'a'.repeat(40) + '/../etc/passwd' }), { status: 200 }),
    );
    await expect(pinTreeToIpfs(validTree())).rejects.toThrow(/malformed CID/);
    fetchSpy.mockRestore();
  });
});

describe('pinTreeToIpfs — XXX-2 request shape + error handling', () => {
  it('POSTs with Bearer token + JSON Content-Type', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'secret-token';
    let capturedInit: RequestInit | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ cid: 'Qm' + 'a'.repeat(44) }), { status: 200 });
    });
    await pinTreeToIpfs(validTree());
    expect(capturedInit?.method).toBe('POST');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers['Content-Type']).toBe('application/json');
    fetchSpy.mockRestore();
  });

  it('passes AbortSignal with timeout (XXX-2)', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    let capturedInit: RequestInit | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ cid: 'Qm' + 'a'.repeat(44) }), { status: 200 });
    });
    await pinTreeToIpfs(validTree());
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    fetchSpy.mockRestore();
  });

  it('throws "web3.storage <status>" on non-2xx', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await expect(pinTreeToIpfs(validTree())).rejects.toThrow(/web3.storage 503/);
    fetchSpy.mockRestore();
  });

  it('payload includes root, leafCount, and serialized leaves', async () => {
    process.env.WEB3_STORAGE_TOKEN = 'test-token';
    let capturedBody: string | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({ cid: 'Qm' + 'a'.repeat(44) }), { status: 200 });
    });
    await pinTreeToIpfs(validTree());
    const body = JSON.parse(capturedBody!);
    expect(body.root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(body.leafCount).toBe(3);
    expect(body.leaves).toHaveLength(3);
    // balanceWei is BigInt — must be serialized as string, not "[object]".
    expect(typeof body.leaves[0].balanceWei).toBe('string');
    expect(body.leaves[0].balanceWei).toBe('1000');
  });
});
