/**
 * Time-formatting helpers shared across activity feeds, notification
 * inboxes, and dashboard summaries.
 *
 * Before Wave-KK, three routes each carried their own copies of `ago()` +
 * `parseInt(timestamp)`. The audit S-6 fix (sort by unix, not by human
 * string) was applied to `notifications/route.ts` but the same bug existed
 * in `portfolio/activity/route.ts` (sort by `a.timestamp < b.timestamp`
 * where `timestamp` is the human "Xm ago" string, non-deterministic).
 *
 * Centralizing the helpers prevents the audit S-6 regression and makes
 * the NaN-rejection (Wave-II audit II-1) uniform everywhere a Scribe
 * timestamp string is parsed.
 */

/**
 * Strict numeric-timestamp parse. Returns null on:
 *   - undefined / null / empty string
 *   - non-numeric content (rejects trailing garbage `parseInt` accepts)
 *   - negative numbers (Scribe timestamps are seconds since epoch)
 *   - implausibly large values (year 9999+)
 */
export function parseTsOrNull(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 253_402_300_799) return null;
  return n;
}

/**
 * Human-readable "5s ago" / "12m ago" / "3h ago" / "2d ago" string.
 * Clamps at 0 so clock skew doesn't render negative durations.
 *
 * NEVER use the returned string as a sort key, it's lexical and
 * non-deterministic. Sort by the underlying unix seconds, then call
 * `ago()` for display only.
 */
export function ago(unixSec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
