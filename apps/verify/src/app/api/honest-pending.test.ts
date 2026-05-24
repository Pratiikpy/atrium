import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-24: cross-route honesty invariant.
 *
 * The "source: 'pending'" convention is the codebase's contract for "we
 * haven't measured this yet." Every route that returns that shape must
 * also return null (or `'—'`) for the primitive fields next to it — never
 * a literal like `'$0.00'`, `'flat'`, `'up'`, `'down'`, or `'0.0s'` that
 * masquerades as a measurement.
 *
 * The previous iters closed U-21 (positions mark/PnL), U-22 (transfer
 * step deltas), and U-23 (direction-without-value) — each one a separate
 * route doing the same wrong thing. This test catches the pattern at a
 * generic level so a new route can't reintroduce it.
 *
 * Scope: only `route.ts` files under `app/api`. Test files and helpers
 * are excluded. The scan is intentionally conservative — it flags
 * obvious string literals in pending-return blocks, not every imaginable
 * fake-value pattern.
 */

const API_DIR = join(dirname(fileURLToPath(import.meta.url)));
const COMPONENTS_DIR = join(API_DIR, '..', '..', 'components');

function walkRoutes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkRoutes(p, out);
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

function walkComponents(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkComponents(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

// Extract object literals that directly emit a pending shape.
// Targets the two emit sites:
//   1. Server routes: NextResponse.json({ ..., source: 'pending', ... })
//   2. Client components: return { ..., source: 'pending', ... } inside
//      a catch block or useQuery fallback.
// Function bodies (which trivially contain `source: 'pending'` anywhere
// inside) are not matched — only the direct object literals are.
function extractPendingObjects(source: string): string[] {
  const out: string[] = [];
  const triggers: RegExp[] = [/NextResponse\.json\(\s*/g, /return\s+/g];
  for (const trigger of triggers) {
    for (const m of source.matchAll(trigger)) {
      const startIdx = (m.index ?? 0) + m[0].length;
      if (source[startIdx] !== '{') continue;
      let depth = 0;
      let j = startIdx;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth !== 0) continue;
      const body = source.slice(startIdx, j + 1);
      if (/source\s*:\s*['"]pending['"]/.test(body)) {
        out.push(body);
      }
    }
  }
  return out;
}

const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Direction-without-value: 'flat' / 'up' / 'down' as a string literal
  // in a pending block. Real measurements set direction; pending must not.
  {
    pattern: /(Direction|direction)\s*:\s*['"](flat|up|down)['"]/,
    reason: 'direction literal in pending block (audit U-23)',
  },
  // Fake-zero dollar literals: '$0' / '$0.00' string values in a pending
  // block. Use null instead.
  {
    pattern: /:\s*['"]\$0(\.\d+)?['"]/,
    reason: '$0 literal in pending block (audit U-21)',
  },
  // Fake step deltas: any '<digit>.<digit>s' string ('0.0s', '1.2s', '8.4s')
  // in a pending block.
  {
    pattern: /:\s*['"]-?\d+\.\d+\s*s['"]/,
    reason: 'time-delta literal in pending block (audit U-22)',
  },
];

// Strip JS comments so the static scan doesn't trip on our own audit
// notes (pre-fix this returned `Direction: 'flat'`). Handles `//` line
// comments and `/* ... slash-star ... */` block comments. Crude but
// correct for the coding style used in this repo.
function stripComments(source: string): string {
  // Block comments first (greedy across newlines).
  let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments — match `//` to end of line. We don't try to skip
  // strings; the patterns we scan for don't appear inside string
  // literals in the source files we cover.
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
  return cleaned;
}

function findFailuresIn(files: string[]): string[] {
  const failures: string[] = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const body of extractPendingObjects(text)) {
      for (const { pattern, reason } of BANNED_PATTERNS) {
        const match = body.match(pattern);
        if (match) {
          failures.push(`${file}: ${reason} → matched '${match[0].trim()}'`);
        }
      }
    }
  }
  return failures;
}

// Extract object literals returned from `.map((x) => ({ ... }))` callbacks.
// Audit U-25: when a route maps over Scribe rows, each row should produce
// distinct per-row values. A literal time-delta or fake-zero in the map
// body means every output row gets the same hardcoded value — the U-22-
// style bug `/api/transfer/recent` had with `duration: '8.4s'`.
function extractMapCallbackObjects(source: string): string[] {
  const out: string[] = [];
  // Two callback shapes: `(x) => ({ ... })` and `(x) => { ... return { ... } }`.
  // The "return { ... }" shape is already covered by extractPendingObjects's
  // return-trigger — here we just catch the arrow-expression form.
  const trigger = /\.map\(\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\(/g;
  for (const m of source.matchAll(trigger)) {
    const startIdx = (m.index ?? 0) + m[0].length;
    if (source[startIdx] !== '{') continue;
    let depth = 0;
    let j = startIdx;
    while (j < source.length) {
      const ch = source[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) continue;
    out.push(source.slice(startIdx, j + 1));
  }
  return out;
}

// Patterns that are NEVER honest inside a `.map` callback: per-row outputs
// must vary, so a literal string measurement means every row ships the
// same fake value. Subset of BANNED_PATTERNS — direction literals are
// allowed (often computed from real signed values).
const MAP_BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /:\s*['"]-?\d+\.\d+\s*s['"]/,
    reason: 'hardcoded time-delta in .map callback (audit U-25)',
  },
];

function findMapFailuresIn(files: string[]): string[] {
  const failures: string[] = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const body of extractMapCallbackObjects(text)) {
      for (const { pattern, reason } of MAP_BANNED_PATTERNS) {
        const match = body.match(pattern);
        if (match) {
          failures.push(`${file}: ${reason} → matched '${match[0].trim()}'`);
        }
      }
    }
  }
  return failures;
}

describe('cross-route honesty invariant — pending blocks return null primitives', () => {
  it('no API route ships direction/dollar/time literals next to source: pending', () => {
    const routes = walkRoutes(API_DIR);
    expect(routes.length).toBeGreaterThan(0);
    expect(findFailuresIn(routes)).toEqual([]);
  });

  it('no client component ships direction/dollar/time literals next to source: pending', () => {
    // Catch-block fallbacks and useState defaults in client components are
    // a parallel vector for the same fake-zero pattern — useQuery
    // catches that return `{ source: 'pending', ... }` must follow the
    // same honest-primitives contract.
    const comps = walkComponents(COMPONENTS_DIR);
    expect(comps.length).toBeGreaterThan(0);
    expect(findFailuresIn(comps)).toEqual([]);
  });

  it('U-25: no .map callback returns a hardcoded time-delta literal', () => {
    // Per-row outputs must vary with the input. A literal `delta: '8.4s'`
    // inside `.map((x) => ({ ... }))` ships the same fake value for every
    // row — the bug /api/transfer/recent had pre-U-24. The invariant
    // covers both API routes and client components.
    const all = [...walkRoutes(API_DIR), ...walkComponents(COMPONENTS_DIR)];
    expect(findMapFailuresIn(all)).toEqual([]);
  });
});
