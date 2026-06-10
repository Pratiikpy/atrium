import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-37: every callsite of `formatUsd(...)` in the verify-app
 * passes a value already known to be non-negative.
 *
 * The U-36 BigInt-native rewrite changed the format for negatives from
 * "$-100.00" (old) to "-$100.00" (new conventional). No existing surface
 * currently relies on negative formatUsd output, but if a future caller
 * starts passing signed values, the new format might break their
 * downstream parsing.
 *
 * This invariant locks the current state: every formatUsd callsite
 * passes a value derived from one of:
 *   - bigint absolute value (`abs`, `Math.abs`, ternary `< 0n ? -x : x`)
 *   - non-negative ERC-4626 / ERC-20 read (always non-negative by contract)
 *   - clamped to >= 0n explicitly
 *
 * Static check by source-text scanning, matching the established pattern
 * from honest-pending.test.ts and verifier-hooks-contract.test.ts.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkTs(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('formatUsd callsite contract', () => {
  it('U-37: every formatUsd callsite is in source files that documented non-negative semantics', () => {
    const files = walkTs(SRC_ROOT);
    const callsiteFiles: string[] = [];
    for (const file of files) {
      const txt = readFileSync(file, 'utf8');
      if (/formatUsd\s*\(/.test(txt) && !file.endsWith('format-usd.ts')) {
        callsiteFiles.push(file);
      }
    }
    expect(callsiteFiles.length).toBeGreaterThan(0);
    // The current callsite set, locked here so a new caller has to
    // explicitly add itself to the list. Forces the author to think about
    // whether their value is non-negative before adding.
    const allowedRelativePaths = [
      'app/api/portfolio/buying-power/route.ts',
      'app/api/portfolio/positions/route.ts',
      'app/api/portfolio/summary/route.ts',
      'app/api/protocol/metrics/route.ts',
      'app/api/reserves/summary/route.ts',
      'app/api/trade/margin-impact/route.ts',
      'app/api/vault/stats/route.ts',
      // Margin Lens (2026-06-10): formats requiredMargin()/hedgeFreedBps()
      // outputs, which are non-negative by construction (span-margin.ts
      // clamps scenario losses at 0n and sums them; see classScenarioLoss).
      'components/portfolio/margin-lens-card.tsx',
    ];
    const actualRelative = callsiteFiles
      .map((f) => f.replace(SRC_ROOT + '\\', '').replace(SRC_ROOT + '/', ''))
      .map((p) => p.replace(/\\/g, '/'))
      .sort();
    expect(actualRelative).toEqual(allowedRelativePaths.slice().sort());
  });

  it('U-37: positions route passes `abs` (the absolute value of notional)', () => {
    const txt = readFileSync(
      join(SRC_ROOT, 'app/api/portfolio/positions/route.ts'),
      'utf8',
    );
    // The route MUST compute abs before formatUsd to avoid feeding a
    // signed notional through. Pre-fix would render "-$1.00" for shorts
    //, visually similar to the U-36 conventional-negative form but
    // semantically wrong (a short position of $1 notional has positive
    // dollar size, the sign encodes direction).
    expect(txt).toContain('const abs = notional < 0n ? -notional : notional');
    expect(txt).toContain('notionalUsd: formatUsd(abs, USDC_DECIMALS)');
  });

  it('U-37: buying-power route passes `free` (clamped >= 0n)', () => {
    const txt = readFileSync(
      join(SRC_ROOT, 'app/api/portfolio/buying-power/route.ts'),
      'utf8',
    );
    // `free = collateral > required ? collateral - required : 0n`, never
    // negative, so formatUsd receives a clean non-negative value.
    expect(txt).toContain('free = collateral > required');
    expect(txt).toContain('formatUsd(free');
  });
});
