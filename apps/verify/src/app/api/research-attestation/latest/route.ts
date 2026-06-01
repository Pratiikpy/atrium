import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';
import { safeErrorDetail } from '@/lib/safe-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/research-attestation/latest
 *
 * Reads the latest on-chain ResearchAttestation from Scribe, then fetches
 * the IPFS-pinned JSON behind its `ipfsHash` to check the honesty flag
 * (`is_publishable`) added in span_backtest.py schema v2.
 *
 * The on-chain attestation only carries (ipfsHash, tradesCount,
 * collateralDeltaBps, timestampSeconds, notebookUrl). The honesty flag
 * lives in the JSON, not the chain, because it's a property of the data
 * methodology (synthetic-pairs vs real-trades), not something the
 * contract should encode.
 *
 * Cache: the attestation is immutable per ipfsHash, so this can be
 * cached for hours. Next-revalidate caches the response for 1 hour;
 * the verify-app surfaces refresh every 60s but mostly hit the cache.
 *
 * Returns:
 *   { attestation: { ...scribe data, isPublishable: boolean, dataMode: string },
 *     warning?: string }
 *   { attestation: null, reason: 'no_attestation_yet' }   on empty
 *   { error: ..., detail: ... }                          on failure
 *
 * Consumers (LiveQuote, components/reserves/*) MUST check `isPublishable`
 * before rendering numbers as live claims. The route also surfaces a
 * `warning` field naming the synthetic-pairs gap when applicable.
 */

interface ScribeRow {
  ipfsHash: string;
  tradesCount: string;
  collateralDeltaBps: string;
  timestampSeconds: string;
  notebookUrl: string | null;
  blockNumber: string;
}

interface IpfsJson {
  schema_version?: number;
  data_mode?: string;
  is_publishable?: boolean;
  trades_count?: number;
  average_saving_bps?: number;
  total_isolated_margin?: number;
}

const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,127})$/;
const IPFS_FETCH_TIMEOUT_MS = 3_000;

export async function GET() {
  let row: ScribeRow | null;
  try {
    const data = await gql<{ backtestAttestations: ScribeRow[] }>(`
      query Latest {
        backtestAttestations(first: 1, orderBy: timestampSeconds, orderDirection: desc) {
          ipfsHash
          tradesCount
          collateralDeltaBps
          timestampSeconds
          notebookUrl
          blockNumber
        }
      }
    `);
    row = data.backtestAttestations[0] ?? null;
  } catch (err) {
    return NextResponse.json(
      { error: 'scribe_unavailable', detail: safeErrorDetail(err) },
      { status: 503 },
    );
  }

  if (!row) {
    return NextResponse.json({ attestation: null, reason: 'no_attestation_yet' }, { status: 404 });
  }

  // Validate the ipfsHash shape before any string interpolation into a
  // gateway URL, same R-1 SSRF gate as /api/lantern/verify-inclusion.
  if (!CID_REGEX.test(row.ipfsHash)) {
    return NextResponse.json(
      {
        attestation: { ...row, isPublishable: false, dataMode: 'unknown' },
        warning: 'attestation ipfsHash is malformed; refusing to fetch JSON behind it',
      },
      { status: 200 },
    );
  }

  const gateway = process.env.IPFS_GATEWAY ?? 'https://ipfs.io';
  if (!/^https:\/\/[a-z0-9.\-]+(:\d+)?$/i.test(gateway)) {
    return NextResponse.json(
      {
        attestation: { ...row, isPublishable: false, dataMode: 'unknown' },
        warning: 'IPFS_GATEWAY misconfigured; honesty flag cannot be checked, assuming NOT publishable',
      },
      { status: 200 },
    );
  }

  let ipfsJson: IpfsJson | null = null;
  try {
    const r = await fetch(`${gateway}/ipfs/${row.ipfsHash}`, {
      signal: AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS),
      // Long cache: attestation JSON is immutable per ipfsHash.
      next: { revalidate: 3600 },
    });
    if (r.ok) {
      ipfsJson = (await r.json()) as IpfsJson;
    }
  } catch {
    // Gateway down, fall through. We refuse to render the attestation as
    // publishable without confirming the flag, since the alternative (assume
    // publishable on fetch failure) violates the honesty contract.
  }

  if (!ipfsJson) {
    return NextResponse.json(
      {
        attestation: { ...row, isPublishable: false, dataMode: 'unknown' },
        warning:
          'IPFS gateway did not return the attestation JSON; treating as NOT publishable until the JSON is reachable',
      },
      { status: 200 },
    );
  }

  // Schema v1 (pre-honesty-pass) attestations have no is_publishable field -
  // those predate the iteration-28 gate. Per the praetor-cli rule, missing
  // field is treated as not-publishable so synthetic v1 outputs that
  // already shipped on-chain don't masquerade as honest results.
  const isPublishable =
    ipfsJson.schema_version != null &&
    ipfsJson.schema_version >= 2 &&
    ipfsJson.is_publishable === true;
  const dataMode = ipfsJson.data_mode ?? 'unknown';

  const warnings: string[] = [];
  if ((ipfsJson.schema_version ?? 0) < 2) {
    warnings.push(`attestation JSON is schema v${ipfsJson.schema_version ?? 1} (pre-honesty-pass)`);
  }
  if (isPublishable === false && ipfsJson.is_publishable === false) {
    warnings.push(`attestation data_mode=${dataMode} is marked NOT publishable`);
  }

  return NextResponse.json({
    attestation: {
      ...row,
      isPublishable,
      dataMode,
      schemaVersion: ipfsJson.schema_version ?? 1,
    },
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
  });
}
