import { NextResponse } from 'next/server';
import { safeErrorDetail } from '@/lib/safe-error';
import { verifyInclusion, type RawLeaf } from '@/lib/lantern-merkle';

export const dynamic = 'force-dynamic';

/**
 * Inclusion verifier — server-side proxy that fetches the tree from IPFS
 * and reports whether `wallet` is in `tree.leaves`.
 *
 * Audit P-11 + R-1 (this fire): originally a GET; rewritten as POST with
 * the wallet in the JSON body so per-user identifiers don't sit in
 * upstream HTTP logs (Vercel, gateway provider). The CID is validated
 * against the canonical CIDv0/CIDv1 character set before interpolation
 * so a hostile caller can't pivot the fetch off-gateway (SSRF) or read
 * sibling paths (path traversal).
 */
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,127})$/;

export async function POST(req: Request) {
  let body: { root?: string; ipfsCid?: string; wallet?: string };
  try {
    body = (await req.json()) as { root?: string; ipfsCid?: string; wallet?: string };
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request_body' }, { status: 400 });
  }
  const { root, ipfsCid, wallet } = body;
  if (!root || !ipfsCid || !wallet) {
    return NextResponse.json({ ok: false, reason: 'missing root/ipfsCid/wallet' }, { status: 400 });
  }
  // Audit R-1 fix: reject anything that isn't a clean CID before any
  // string interpolation into the gateway URL. This forecloses both SSRF
  // (e.g. `bad-host/x`) and path traversal (e.g. `Qm…/../etc`).
  if (!CID_REGEX.test(ipfsCid)) {
    return NextResponse.json({ ok: false, reason: 'invalid_cid' }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ ok: false, reason: 'invalid_wallet' }, { status: 400 });
  }
  // 079-BE6: the attested root is the value we verify the published tree
  // against, so it must be a real 32-byte hash before we compare.
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
    return NextResponse.json({ ok: false, reason: 'invalid_root' }, { status: 400 });
  }
  const walletLc = wallet.toLowerCase();
  const gateway = process.env.IPFS_GATEWAY ?? 'https://ipfs.io';
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(gateway)) {
    return NextResponse.json({ ok: false, reason: 'gateway_misconfigured' }, { status: 500 });
  }
  try {
    const r = await fetch(`${gateway}/ipfs/${ipfsCid}/tree.json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, reason: 'IPFS gateway unreachable; tree not pinned yet' });
    }
    const tree = (await r.json()) as {
      leaves?: Array<{ user?: string; balanceWei?: string; salt?: string }>;
    };
    const leaves = tree.leaves;
    if (!Array.isArray(leaves) || leaves.length === 0) {
      return NextResponse.json({ ok: false, reason: 'attested tree is empty or malformed' });
    }
    // Validate every leaf before hashing so a poisoned/malformed tree can't
    // crash the recompute or smuggle non-conforming data through it.
    for (const l of leaves) {
      if (
        !l ||
        typeof l.user !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(l.user) ||
        typeof l.balanceWei !== 'string' || !/^\d+$/.test(l.balanceWei) ||
        typeof l.salt !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(l.salt)
      ) {
        return NextResponse.json({ ok: false, reason: 'attested tree contains a malformed leaf' });
      }
    }
    // 079-BE6 fix: actually verify. Recompute the Merkle root from the
    // published leaves and confirm it equals the on-chain attested `root`
    // (so the IPFS tree is provably the attested one), then confirm the
    // wallet's leaf folds up its sibling path to that same root. No more
    // "Verified" from a bare address match.
    const res = verifyInclusion(leaves as RawLeaf[], walletLc, root);
    if (!res.rootMatches) {
      return NextResponse.json({
        ok: false,
        reason: 'published tree does not hash to the attested on-chain root',
        recomputedRoot: res.recomputedRoot,
        attestedRoot: root,
      });
    }
    if (res.leafIndex === null) {
      return NextResponse.json({ ok: false, reason: 'wallet not found in the attested tree' });
    }
    return NextResponse.json({
      ok: res.included,
      reason: res.included
        ? 'Verified: the published tree hashes to the on-chain attested root, and your inclusion proof reproduces it.'
        : 'inclusion proof did not reproduce the attested root',
      leaf: leaves[res.leafIndex].user,
      leafIndex: res.leafIndex,
      recomputedRoot: res.recomputedRoot,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: `gateway error: ${safeErrorDetail(err)}` });
  }
}
