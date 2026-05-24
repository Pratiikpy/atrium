import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Kani CI status — read by the badge in the layout. Audit J-C1 fix: the
 * badge previously rendered a hardcoded "3 of 5" green dot regardless of
 * actual CI state, which violated the testing rule "CI badge must reflect
 * the real state."
 *
 * Source of truth, in order of preference:
 *   1. `KANI_STATUS_URL` env var → proxy to a GitHub Actions / shields.io
 *      JSON endpoint. CI updates this on every main-branch run.
 *   2. Local file `public/kani-status.json` → CI artifact committed by the
 *      Kani workflow on success. Fixed this fire: previously the docstring
 *      promised this fallback but the code never read the file.
 *   3. Honest "checking" fallback when neither is configured.
 *
 * The honest-default total reflects current in-repo Kani proof count
 * (math.rs: 4 + span.rs: 2 = 6). This is a floor; real CI authority
 * overrides via path (1) or (2).
 */
interface KaniStatus {
  // 'in-development' is the honest interim state when the proofs exist in
  // repo but the Kani CI lane hasn't been activated yet, distinct from
  // 'unknown' (no measurement at all) and 'pass'/'fail' (real CI verdict).
  // Audit 2026-05-24 alpha.4 introduced this when kani-status.json was
  // changed from claimed `pass` to honest `in-development`.
  state: 'pass' | 'fail' | 'unknown' | 'in-development';
  /**
   * Iteration 38 audit fix: was `number` with a `?? 0` fallback when the
   * upstream didn't provide the field. That meant the route returned
   * `passed: 0` when no measurement existed — UI rendered "Kani CI · 0 of
   * 6" which looks like "all 6 proofs failed" but actually means "no
   * measurement taken." Now `number | null`; null = unmeasured. The badge
   * distinguishes the two cases visually.
   */
  passed: number | null;
  total: number;
  last_run_at: string | null;
  proof_run_url: string | null;
  source: string;
}

// Current in-repo Kani proof count. When a new #[kani::proof] lands, bump.
// Real count per `grep -r '#\[kani::proof\]' contracts/` on 2026-05-24:
//   plinth/src/math.rs:  4 (median_bounded, abs_diff_bps_self_zero, normalize_monotonic, oracle_freshness_rejects_stale)
//   plinth/src/span.rs:  2 (solvency_non_negative, monotonic_in_notional)
//   sigil/src/eip712.rs: 2 (day_index_basic, caps_reject_oversize_notional)
//   sigil/src/lib.rs:    1
// Total: 9. Bumped from prior 6 after Auditor E identified the undercount.
// See public/kani-status.json `notes` for the per-file mapping.
const KANI_PROOF_FLOOR = 9;

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<KaniStatus>> {
  const url = process.env.KANI_STATUS_URL;
  if (url) {
    try {
      const r = await fetch(url, {
        // Cache for 60s so the badge doesn't hammer GitHub.
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2_000),
      });
      if (r.ok) {
        const upstream = (await r.json()) as Partial<KaniStatus>;
        return NextResponse.json<KaniStatus>({
          state: upstream.state ?? 'unknown',
          // null when upstream omits the field. An explicit `0` in the
          // artifact (all proofs failed) is preserved by nullish-coalescing.
          passed: upstream.passed ?? null,
          total: upstream.total ?? KANI_PROOF_FLOOR,
          last_run_at: upstream.last_run_at ?? null,
          proof_run_url: upstream.proof_run_url ?? null,
          source: url,
        });
      }
    } catch {
      // Fall through to file-fallback then honest "unknown".
    }
  }

  // Path (2): committed CI artifact at public/kani-status.json.
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'kani-status.json');
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text) as Partial<KaniStatus>;
    return NextResponse.json<KaniStatus>({
      state: parsed.state ?? 'unknown',
      passed: parsed.passed ?? null,
      total: parsed.total ?? KANI_PROOF_FLOOR,
      last_run_at: parsed.last_run_at ?? null,
      proof_run_url: parsed.proof_run_url ?? null,
      source: 'public/kani-status.json',
    });
  } catch {
    // File not present (yet) — fall through to honest unknown.
  }

  return NextResponse.json<KaniStatus>({
    state: 'unknown',
    // Honest pending — no source configured, no measurement to report.
    passed: null,
    total: KANI_PROOF_FLOOR,
    last_run_at: null,
    proof_run_url: null,
    source: 'no-status-source-configured',
  });
}
