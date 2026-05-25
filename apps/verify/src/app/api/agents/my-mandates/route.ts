import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/my-mandates
 *
 * Lists the Sigil mandates issued by DEMO_WALLET_ADDRESS that have NOT been
 * revoked. Reads SigilValidation and SigilRevocation events from Scribe and
 * computes the active set as (validations - revocations) keyed by intentHash.
 *
 * Honesty contract:
 *   - No wallet env → `mandates: []`, `source: 'pending'`
 *   - Scribe outage → empty list, `source: 'pending'` with a named reason
 *   - Healthy → `source: 'scribe'`, mandates array with revoke-tx links
 *
 * Powers the "My mandates" tab in /app/agents.
 */

interface ScribeValidation {
  id: string;
  agent: string;
  intentHash: string;
  blockNumber: string;
  timestamp: string;
  txHash: string;
}

interface ScribeRevocation {
  agent: string | null;
  intentHash: string | null;
  timestamp: string;
}

export interface Mandate {
  intentHash: string;
  agent: string;
  issuedAtTimestamp: number;
  txHash: string;
}

export async function GET(req?: Request) {
  // Phase theta audit follow-up: ?wallet= multi-tenant support.
  const walletParam = req ? new URL(req.url).searchParams.get('wallet') : null;
  const wallet =
    walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)
      ? walletParam
      : process.env.DEMO_WALLET_ADDRESS ?? null;
  if (!wallet) {
    return NextResponse.json({ mandates: [], source: 'pending', reason: 'no_wallet_configured' });
  }

  try {
    const owner = wallet.toLowerCase();
    const data = await gql<{
      sigilValidations: ScribeValidation[];
      sigilRevocations: ScribeRevocation[];
    }>(
      `query MyMandates($owner: Bytes!) {
        sigilValidations(first: 500, where: { owner: $owner }, orderBy: timestamp, orderDirection: desc) {
          id
          agent
          intentHash
          blockNumber
          timestamp
          txHash
        }
        sigilRevocations(first: 500, where: { owner: $owner }) {
          agent
          intentHash
          timestamp
        }
      }`,
      { owner },
    );

    // Compute the live mandate set: drop any validation whose intentHash has
    // since been revoked. Keyed by intentHash because that's the Sigil's
    // identity — a single agent can hold multiple mandates with different
    // intents (one for hedging, one for stat-arb).
    const revokedHashes = new Set<string>();
    for (const r of data.sigilRevocations ?? []) {
      if (typeof r.intentHash === 'string') revokedHashes.add(r.intentHash);
    }

    const mandates: Mandate[] = [];
    for (const v of data.sigilValidations ?? []) {
      if (revokedHashes.has(v.intentHash)) continue;
      const ts = Number(v.timestamp);
      if (!Number.isFinite(ts)) continue;
      mandates.push({
        intentHash: v.intentHash,
        agent: v.agent,
        issuedAtTimestamp: ts,
        txHash: v.txHash,
      });
    }

    return NextResponse.json({ mandates, source: 'scribe' as const });
  } catch {
    return NextResponse.json({ mandates: [], source: 'pending', reason: 'scribe_unavailable' });
  }
}
