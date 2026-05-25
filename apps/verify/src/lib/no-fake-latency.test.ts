import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-38: no setTimeout / setInterval / Math.random in non-test
 * production code.
 *
 * The desing/ prototype HTMLs use setTimeout(2400) to fake passkey-signing
 * latency and Math.random for synthetic mandate caps. Pre-iter-53 the
 * onboarding-flow lifted these mocks into the real app; the U-9 round
 * caught it. This invariant locks the pattern across the whole src/ tree
 * a new component can't smuggle in "fake 2s wait" or "rand() %  100"
 * without the test tripping.
 *
 * Legitimate uses (intentionally allowed via per-file allowlist):
 *   - apps/verify/src/app/chaos/page.tsx (Phase zeta.5 2026-05-25):
 *     setTimeout schedules the /api/chaos/restore call 5 s after inject
 *     so the Verifier walk Step 4 self-heals. It is real scheduling
 *     against a real endpoint (not a fake spinner). Removing it breaks
 *     the auto-restore demo. A server-side delayed worker is overkill
 *     for a 5-second timer.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWLIST: { file: string; allowed: RegExp[]; reason: string }[] = [
  {
    file: 'app/chaos/page.tsx',
    allowed: [/\bsetTimeout\s*\(/],
    reason: 'Phase zeta.5 chaos auto-restore (real /api/chaos/restore call 5s after inject)',
  },
];

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkTs(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.(t|j)sx?$/.test(name)) out.push(p);
  }
  return out;
}

// Strip JS/TS comments so a doc-comment mentioning "setTimeout" doesn't trip.
function stripComments(source: string): string {
  let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
  return cleaned;
}

const BANNED: { pattern: RegExp; reason: string }[] = [
  // setTimeout/setInterval: classic fake-latency simulation pattern from
  // the desing/ prototype. Real async state should flow from network
  // events (fetch, wagmi tx receipts) or TanStack Query intervals.
  { pattern: /\bsetTimeout\s*\(/, reason: 'setTimeout banned in production code (fake-latency anti-pattern)' },
  { pattern: /\bsetInterval\s*\(/, reason: 'setInterval banned — use TanStack Query refetchInterval instead' },
  // Math.random: invented data. crypto.getRandomValues is fine.
  { pattern: /\bMath\.random\s*\(/, reason: 'Math.random banned (fake-data anti-pattern); use crypto.getRandomValues for nonces' },
];

describe('no fake-latency or fake-data patterns in production code', () => {
  it('U-38: no setTimeout / setInterval / Math.random outside tests', () => {
    const files = walkTs(SRC_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      const text = stripComments(readFileSync(file, 'utf8'));
      // Per-file allowlist: a pattern matched in an allowlisted file is
      // skipped only when it appears in the allowed-patterns set for that
      // file. Other patterns still raise.
      const allowlistEntry = ALLOWLIST.find((a) => file.replace(/\\/g, '/').endsWith(a.file));
      for (const { pattern, reason } of BANNED) {
        const match = text.match(pattern);
        if (!match) continue;
        const isAllowed = allowlistEntry?.allowed.some((p) => p.source === pattern.source);
        if (isAllowed) continue;
        failures.push(`${file}: ${reason} matched '${match[0]}'`);
      }
    }
    expect(failures).toEqual([]);
  });
});
