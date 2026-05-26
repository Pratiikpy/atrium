import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-42: `docs/conventions/writing.md` declares a list of banned words
 * that must never appear in user-facing copy ("delve", "unlock",
 * "unleash", "robust", "empower", "seamless", "streamline",
 * "cutting-edge", "state-of-the-art", "revolutionize").
 *
 * Two banned terms — "leverage" and "harness" — are legitimate domain
 * vocabulary (leverage = derivatives ratio; harness = formal-verification
 * test rig) and are excluded from the scan. The other ten are
 * exclusively marketing-speak with no domain meaning in our context.
 *
 * Scope: only user-facing source (.tsx in components/ + app/). Test
 * files are excluded — they can mention banned words in test strings
 * to document the rule.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BANNED = [
  'delve',
  'unlock',
  'unleash',
  'robust',
  'empower',
  'seamless',
  'streamline',
  'cutting-edge',
  'state-of-the-art',
  'revolutionize',
] as const;

// Audit U-43: banned phrases from writing.md's "Banned phrases and
// patterns" list. These are multi-word matches so we scan as strings,
// not regex word-boundaries.
const BANNED_PHRASES = [
  "in today's fast-paced",
  'in the realm of',
  'game changing',
  'game-changing',
  'next generation',
  'we are excited to announce',
  'we are proud to share',
  'we are excited to share',
  'we are proud to announce',
  'built with love',
] as const;

function walkUserFacing(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkUserFacing(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

// Strip JS/TS comments + string literals that are clearly framework
// boilerplate (imports, metadata.description). We want to catch banned
// words in user-facing strings, not in identifiers or comments.
function stripCommentsAndJsxAttributes(source: string): string {
  let cleaned = source.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
  // Lower-case so we catch e.g. "Leverage" vs "leverage" without doubling
  // the pattern list.
  return cleaned.toLowerCase();
}

describe('U-42 + U-43: no banned writing-rule words or phrases in user-facing components', () => {
  it('no docs/conventions/writing.md banned word appears in any *.tsx', () => {
    const files = walkUserFacing(SRC_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      const text = stripCommentsAndJsxAttributes(readFileSync(file, 'utf8'));
      for (const word of BANNED) {
        // \b on hyphenated terms is tricky; use a non-letter boundary.
        const pattern = new RegExp(`(^|[^a-z-])${word}([^a-z-]|$)`);
        if (pattern.test(text)) {
          failures.push(`${file}: banned word "${word}"`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('U-43: no banned phrase appears in any *.tsx', () => {
    const files = walkUserFacing(SRC_ROOT);
    const failures: string[] = [];
    for (const file of files) {
      const text = stripCommentsAndJsxAttributes(readFileSync(file, 'utf8'));
      for (const phrase of BANNED_PHRASES) {
        if (text.includes(phrase)) {
          failures.push(`${file}: banned phrase "${phrase}"`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
