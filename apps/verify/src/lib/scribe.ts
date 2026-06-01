'use client';

import { useQuery } from '@tanstack/react-query';
import { gql } from './scribe-helpers';

/**
 * Client-side hooks over the shared `gql` helper from `lib/scribe-helpers.ts`.
 *
 * Audit PP-2 fix: this file previously carried its own copy of `gql()` that
 * lacked the audit P-7 3-second `AbortSignal.timeout` AND the audit FF-1
 * "errors AND data both present → error wins" check. A slow Scribe could
 * stack hanging client-side requests across the 30s refetchInterval of every
 * LiveCounter on the landing page. Now both halves of the app (server-side
 * routes + client-side hooks) share one gql with one set of guarantees.
 */

// ============================================================================
// Hooks
// ============================================================================

/**
 * Audit VV-1: previously this hook queried `{ count: ${entityKey}Count }`
 * which is NOT a query The Graph auto-generates. Every call would have
 * thrown at gql-time. The hook is currently unused, `LiveCounter` defines
 * the consumer but no page renders it, so the bug was dormant. The hook
 * stays here as a typed surface for the future, but the query is now valid:
 * it reads the first entity record and treats existence as a 0-or-N signal.
 * Real count surfaces need a `Counter @entity` aggregation added to the
 * subgraph mapping layer (tracked in `human_left.md` #26).
 */
export function useScribeCount(entityKey: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scribeCount', entityKey],
    queryFn: async () => {
      // Defensive query, pulls 1 entity to verify the entity name exists.
      // A real count needs Counter entities populated by mapping handlers.
      const json = await gql<Record<string, unknown[]>>(
        `{ items: ${entityKey}(first: 1) { id } }`,
      );
      return { count: Array.isArray(json.items) ? json.items.length : 0 };
    },
    refetchInterval: 30_000,
    retry: 1,
  });
  return { count: data?.count ?? 0, isLoading, error };
}

export interface ResearchAttestation {
  ipfsHash: string;
  tradesCount: number;
  collateralDeltaBps: number;
  timestampSeconds: number;
  notebookUrl: string;
  /** Baseline isolated-margin USD figure published with the attestation. */
  baselineUsd?: number;
  /**
   * True only when the IPFS-pinned JSON behind `ipfsHash` declares
   * `is_publishable: true` (schema v2+ from span_backtest.py).
   *
   * Consumers MUST refuse to render numbers as live claims when this is
   * false, synthetic-pairs backtests can satisfy the on-chain
   * ResearchAttestation contract but produce trivially-inflated savings
   * figures (perfectly-hedged pairs always show large savings). The
   * verify-app honesty contract requires UI surfaces to surface the
   * "not publishable" state explicitly rather than silently render
   * the synthetic numbers as truth.
   *
   * False on:
   *   - schema v1 attestations (pre-honesty-pass)
   *   - JSON missing the field
   *   - IPFS gateway unreachable (fail-safe: assume not publishable)
   *   - data_mode = synthetic-pairs explicitly
   */
  isPublishable?: boolean;
  /** "real-trades" | "synthetic-pairs" | "unknown", surfaced for UI tags. */
  dataMode?: string;
  /** Operator-facing warning when the attestation can't be rendered as live. */
  honestyWarning?: string;
}

/**
 * Reads via `/api/research-attestation/latest` instead of querying Scribe
 * directly. The server-side route adds the IPFS-side honesty check that
 * can't be done from the client (cache-friendly server fetch + gateway
 * config). Pre-iteration-30 this hook queried Scribe directly and
 * consumers had no way to distinguish synthetic-pairs attestations from
 * real-trades, UI would render synthetic numbers as live.
 */
export function useResearchAttestation() {
  return useQuery<ResearchAttestation | null>({
    queryKey: ['researchAttestationLatestWithHonesty'],
    queryFn: async () => {
      const r = await fetch('/api/research-attestation/latest');
      if (!r.ok) {
        // 404 is the "no attestation yet" state; 503 etc. propagate as error.
        if (r.status === 404) return null;
        throw new Error(`research-attestation/latest status_${r.status}`);
      }
      const body = (await r.json()) as {
        attestation: ResearchAttestation | null;
        warning?: string;
      };
      if (!body.attestation) return null;
      return {
        ...body.attestation,
        // Normalize the Scribe-string numerics to JS numbers at the boundary.
        // The API returns them as strings (BigInt-as-string per Scribe convention);
        // surfaces expect numbers. Use Number() and not parseFloat to fail
        // loudly on non-numeric strings.
        tradesCount: Number(body.attestation.tradesCount),
        collateralDeltaBps: Number(body.attestation.collateralDeltaBps),
        timestampSeconds: Number(body.attestation.timestampSeconds),
        honestyWarning: body.warning,
      };
    },
    refetchInterval: 60_000,
    retry: 1,
  });
}
