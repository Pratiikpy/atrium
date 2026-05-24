import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { parseTsOrNull } from '@/lib/format-time';
import { safeErrorDetail } from '@/lib/safe-error';

/**
 * GET /api/lantern/latest
 *
 * Returns the most-recent LanternAttestation indexed by Scribe. If no
 * attestation exists yet, returns 404 so the Lantern dashboard renders the
 * empty state instead of a fake number.
 *
 * Audit J-M10 fix: generic was typed as `{ backtestAttestations: any[] }`
 * but the query asks for `lanternAttestations`. Type now matches the query
 * and the `any` cast is gone.
 *
 * Audit NN-3 fix: Scribe returns numeric fields as strings (BigInt-as-string
 * convention). Prior code typed them as `number` and let downstream components
 * implicitly coerce — `new Date(timestamp * 1000)` on a malformed string
 * rendered the literal "Invalid Date" in the dashboard. Now the route
 * parses + validates each field and returns 404 if any are corrupt, the
 * same shape as "no attestation exists" so the dashboard renders the empty
 * state honestly.
 */
interface AttestationWire {
  root: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  leafCount: number;
  ipfsCid: string;
}

interface ScribeLatest {
  lanternAttestations: Array<{
    root: string;
    blockNumber: string;
    timestamp: string;
    leafCount: string;
    ipfsCid: string;
  }>;
}

function parseStrictPositiveInt(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET() {
  try {
    const data = await gql<ScribeLatest>(`
      query Latest {
        lanternAttestations(first: 1, orderBy: blockNumber, orderDirection: desc) {
          root
          blockNumber
          timestamp
          leafCount
          ipfsCid
        }
      }
    `);
    const latest = data.lanternAttestations?.[0];
    if (!latest) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }
    const blockNumber = parseStrictPositiveInt(latest.blockNumber);
    const timestamp = parseTsOrNull(latest.timestamp);
    const leafCount = parseStrictPositiveInt(latest.leafCount);
    if (blockNumber == null || timestamp == null || leafCount == null) {
      // Corrupt Scribe row — surface as "no attestation" rather than ship
      // NaN downstream. The dashboard's empty state is the honest result.
      return NextResponse.json({ exists: false, reason: 'corrupt_indexed_row' }, { status: 404 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(latest.root)) {
      return NextResponse.json({ exists: false, reason: 'corrupt_root' }, { status: 404 });
    }
    // Audit TT-17 fix: LanternAttestor.publish() does NOT carry ipfsCid in
    // its on-chain event — only (root, block_number, signature). The
    // subgraph mapping leaves ipfsCid unset; this route would otherwise
    // ship undefined to the dashboard, which then calls
    // /api/lantern/verify-inclusion with `ipfsCid: undefined` → 400.
    // Treat missing ipfsCid as corrupt-row → empty state. The real fix
    // needs a contract event extension (see human_left.md #25).
    if (!latest.ipfsCid || typeof latest.ipfsCid !== 'string' || latest.ipfsCid.length < 10) {
      return NextResponse.json(
        { exists: false, reason: 'missing_ipfs_cid' },
        { status: 404 },
      );
    }
    const wire: AttestationWire = {
      root: latest.root as `0x${string}`,
      blockNumber,
      timestamp,
      leafCount,
      ipfsCid: latest.ipfsCid,
    };
    return NextResponse.json(wire);
  } catch (err) {
    return NextResponse.json(
      { error: 'scribe_unavailable', detail: safeErrorDetail(err) },
      { status: 503 }
    );
  }
}
