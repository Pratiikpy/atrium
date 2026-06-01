import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { computeRoot, type RawLeaf } from '@/lib/lantern-merkle';

/**
 * Locks the audit R-1 fix at the unit-test layer.
 *
 * The verify-inclusion route is a thin proxy that fetches an IPFS-pinned
 * Merkle tree and reports inclusion. The audit found that prior code
 * interpolated `ipfsCid` directly into the gateway URL — letting a hostile
 * caller pivot to any host (SSRF) or read sibling paths (`Qm…/../etc`).
 *
 * The fix pins a strict CIDv0/CIDv1 regex and validates the gateway
 * scheme. This file pins both gates so future refactors can't quietly
 * widen them.
 */

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/lantern/verify-inclusion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/lantern/verify-inclusion — input validation', () => {
  it('rejects a non-JSON body with bad_request_body', async () => {
    const req = new Request('http://localhost/api/lantern/verify-inclusion', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('bad_request_body');
  });

  it('rejects missing root/ipfsCid/wallet', async () => {
    const res = await POST(makePostRequest({ root: '0xaa' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toMatch(/missing/);
  });

  it('rejects path-traversal in CID (audit R-1)', async () => {
    // The single most important SSRF/traversal test.
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: 'QmTraversal/../../../etc/passwd',
        wallet: '0x' + 'a'.repeat(40),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid_cid');
  });

  it('rejects SSRF in CID (host pivot)', async () => {
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: 'attacker.example.com/payload',
        wallet: '0x' + 'a'.repeat(40),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid_cid');
  });

  it('rejects an obviously-malformed CID', async () => {
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: 'definitely-not-a-cid',
        wallet: '0x' + 'a'.repeat(40),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid_cid');
  });

  it('accepts a valid CIDv0 (Qm… 46 chars total)', async () => {
    // Real-shape CIDv0: "Qm" + 44 base58 chars.
    const validV0 = 'Qm' + 'a'.repeat(44).replace(/0|O|I|l/g, 'A');
    // Mock the gateway response so we don't depend on the network.
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ leaves: [] }), { status: 200 }),
    );
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: validV0,
        wallet: '0x' + 'a'.repeat(40),
      }),
    );
    // Validation passes — should NOT be 400 invalid_cid.
    const json = await res.json();
    expect(json.reason).not.toBe('invalid_cid');
  });

  it('accepts a valid CIDv1 (b… base32, 59+ chars)', async () => {
    // CIDv1 base32: "b" + base32 chars (a-z, 2-7).
    const validV1 = 'b' + 'a'.repeat(58);
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ leaves: [] }), { status: 200 }),
    );
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: validV1,
        wallet: '0x' + 'a'.repeat(40),
      }),
    );
    const json = await res.json();
    expect(json.reason).not.toBe('invalid_cid');
  });

  it('rejects an invalid wallet shape', async () => {
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: 'Qm' + 'a'.repeat(44).replace(/0|O|I|l/g, 'A'),
        wallet: 'not-an-address',
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid_wallet');
  });

  it('rejects wallet without 0x prefix', async () => {
    const res = await POST(
      makePostRequest({
        root: '0x' + 'a'.repeat(64),
        ipfsCid: 'Qm' + 'a'.repeat(44).replace(/0|O|I|l/g, 'A'),
        wallet: 'a'.repeat(40), // 40 hex chars but no 0x
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid_wallet');
  });

  it('rejects a misconfigured gateway env var (audit R-1 secondary)', async () => {
    // If someone misconfigures IPFS_GATEWAY to a non-https scheme or an
    // ip-literal with a query string, the route must refuse rather than
    // forward to it. This is the secondary line of defense.
    const prevGateway = process.env.IPFS_GATEWAY;
    process.env.IPFS_GATEWAY = 'http://insecure.example.com'; // http not https
    try {
      const res = await POST(
        makePostRequest({
          root: '0x' + 'a'.repeat(64),
          ipfsCid: 'Qm' + 'a'.repeat(44).replace(/0|O|I|l/g, 'A'),
          wallet: '0x' + 'a'.repeat(40),
        }),
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.reason).toBe('gateway_misconfigured');
    } finally {
      if (prevGateway === undefined) delete process.env.IPFS_GATEWAY;
      else process.env.IPFS_GATEWAY = prevGateway;
    }
  });
});

describe('POST /api/lantern/verify-inclusion — real verification (079-BE6)', () => {
  const salt = (n: number) => (`0x${n.toString(16).padStart(64, '0')}`);
  const VALID_CID = 'Qm' + 'a'.repeat(44).replace(/0|O|I|l/g, 'A');
  const walletA = '0x' + 'a'.repeat(40);
  const walletB = '0x' + 'b'.repeat(40);
  const leaves: RawLeaf[] = [
    { user: walletA, balanceWei: '1000000', salt: salt(1) },
    { user: walletB, balanceWei: '2500000', salt: salt(2) },
  ];
  const root = computeRoot(leaves);
  const treeResponse = () => new Response(JSON.stringify({ leaves }), { status: 200 });

  it('returns ok=true when the tree hashes to the attested root and the wallet is included', async () => {
    (global.fetch as any).mockResolvedValue(treeResponse());
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: walletA }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reason).toMatch(/Verified/);
    expect(json.leafIndex).toBe(0);
    expect((json.recomputedRoot as string).toLowerCase()).toBe(root.toLowerCase());
  });

  it('REJECTS a present wallet when the published tree does not hash to the attested root (the core fix)', async () => {
    // Pre-fix this returned ok purely on the address match, ignoring the root.
    (global.fetch as any).mockResolvedValue(treeResponse());
    const wrongRoot = '0x' + 'd'.repeat(64);
    const res = await POST(makePostRequest({ root: wrongRoot, ipfsCid: VALID_CID, wallet: walletA }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toMatch(/does not hash to the attested/);
  });

  it('returns ok=false when the wallet is not in the tree (root matches)', async () => {
    (global.fetch as any).mockResolvedValue(treeResponse());
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: '0x' + 'c'.repeat(40) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toMatch(/not found/);
  });

  it('verifies case-insensitively', async () => {
    (global.fetch as any).mockResolvedValue(treeResponse());
    const upper = walletA.toUpperCase().replace('0X', '0x');
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: upper }));
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('rejects a malformed leaf (missing salt) rather than vouching for it', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ leaves: [{ user: walletA, balanceWei: '1' }] }), { status: 200 }),
    );
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: walletA }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toMatch(/malformed leaf/);
  });

  it('returns ok=false when gateway returns non-200', async () => {
    (global.fetch as any).mockResolvedValue(new Response('', { status: 503 }));
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: walletA }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toMatch(/IPFS gateway unreachable/);
  });

  it('returns ok=false when gateway throws (timeout / network)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('timeout exceeded'));
    const res = await POST(makePostRequest({ root, ipfsCid: VALID_CID, wallet: walletA }));
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toMatch(/gateway error.*timeout/);
  });
});
