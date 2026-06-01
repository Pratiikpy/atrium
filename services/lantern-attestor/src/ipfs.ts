import type { Tree } from './merkle';

/**
 * Pin the Merkle tree (leaves + layers) to IPFS via web3.storage free tier.
 * Users download the tree and verify their own inclusion proof.
 *
 * Audit XXX-2 + XXX-3: shares the same CID validation pattern used by the
 * server route /api/lantern/verify-inclusion (R-1) and the client dashboard
 * (UUU-2). If/when the LanternAttestor contract extension (human_left.md
 * #25) starts carrying the CID on-chain, an unvalidated malformed CID
 * would propagate from this service to the indexer to the UI to the IPFS
 * gateway, the same SSRF surface. Validate at the source.
 */
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,127})$/;
const PIN_TIMEOUT_MS = 30_000;

export async function pinTreeToIpfs(tree: Tree): Promise<string> {
  const token = process.env.WEB3_STORAGE_TOKEN;
  if (!token) {
    console.warn('[lantern] WEB3_STORAGE_TOKEN missing; skipping IPFS pin');
    return '';
  }

  const payload = {
    version: 1,
    root: `0x${tree.root.toString('hex')}`,
    publishedAt: new Date().toISOString(),
    leafCount: tree.leaves.length,
    leaves: tree.leaves.map((l) => ({
      user: l.user,
      balanceWei: l.balanceWei.toString(),
      salt: l.salt,
    })),
  };

  // Audit XXX-2 fix: explicit timeout. Pre-fix the Lantern hourly cron
  // could hang forever on a slow web3.storage response, stalling
  // subsequent publishes. 30s is generous for a typical tree-payload
  // upload (sub-100KB) while bounding the worst case.
  const r = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(PIN_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`web3.storage ${r.status}`);
  const json = (await r.json()) as { cid?: unknown };
  // Audit XXX-3 fix: validate the returned CID shape before propagating.
  // A malformed CID reaching downstream consumers would be the same SSRF
  // surface as UUU-2 / R-1, keep this check in sync with those regexes.
  if (typeof json.cid !== 'string' || !CID_REGEX.test(json.cid)) {
    throw new Error(`web3.storage returned malformed CID: ${typeof json.cid}`);
  }
  return json.cid;
}
