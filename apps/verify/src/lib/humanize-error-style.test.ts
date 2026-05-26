import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-44: humanize-error functions across components share one
 * voice convention — lowercase opener (except for contract names like
 * "Sigil", "Coffer"), no trailing period. Matches the founder-voice
 * guideline in `docs/conventions/writing.md`: plain, conversational
 * fragments rather than full sentences.
 *
 * Pre-fix, `components/agents/new-mandate-button.tsx`'s
 * `humanizeIssueError` was the only outlier — sentence-case + trailing
 * periods. Normalized to match the other three (vault deposit/withdraw,
 * trade order-form). This test pins the convention going forward.
 *
 * Scope: scan every `function humanize...` body for return statements
 * ending in a period.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkTs(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Extract every `function humanize...(...){...}` body. Returns the
 * raw function-body string for each match.
 */
function extractHumanizeFunctions(source: string): string[] {
  const out: string[] = [];
  const re = /function\s+humanize[A-Za-z]*\s*\([^)]*\)\s*:\s*[A-Za-z]+\s*\{/g;
  for (const m of source.matchAll(re)) {
    const start = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let j = start;
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') depth--;
      j++;
    }
    out.push(source.slice(start, j - 1));
  }
  return out;
}

describe('U-44: humanize-error functions share lowercase-no-period style', () => {
  it('no humanize-function return string ends in a period', () => {
    const files = walkTs(SRC_ROOT);
    const failures: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const body of extractHumanizeFunctions(text)) {
        // Match `return '...'` or `return "..."` patterns; reject any
        // that end with a period before the closing quote.
        const returnRe = /return\s+['"]([^'"]*)['"]/g;
        for (const r of body.matchAll(returnRe)) {
          const s = r[1];
          // Skip empty strings + strings that intentionally end with `…`
          // (the slice-truncation fallback).
          if (s === '' || s.endsWith('…')) continue;
          if (s.endsWith('.')) {
            failures.push(`${file}: humanize-return ends with period — "${s}"`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
