#!/usr/bin/env node
/**
 * scripts/check-banned-words.mjs
 * Greps tracked files for banned marketing words per docs/conventions/writing.md.
 * Exit 1 if any hits found.
 *
 * False-positive guard: 'leverage' as a financial noun (e.g., '10x leverage',
 * 'leverage ratio') is allowed. Only verb forms ('leverage our', 'leveraging') flag.
 *
 * Run: node scripts/check-banned-words.mjs
 */
import { execSync } from 'node:child_process';

const BANNED_PATTERNS = [
  { pattern: /\bdelve\b/i, word: 'delve' },
  { pattern: /\brobust\b/i, word: 'robust' },
  { pattern: /\bleverag(e\s+(our|the|its|this|that|their|your)|ing)\b/i, word: 'leverage (verb)' },
  { pattern: /\bseamless(ly)?\b/i, word: 'seamless' },
  { pattern: /\bharness(es|ed|ing)?\s+(the|our|its|this|that|their|your|power|potential|capabilities)/i, word: 'harness (verb)' },
  { pattern: /\bstreamline[ds]?\b/i, word: 'streamline' },
  { pattern: /\bcutting[- ]edge\b/i, word: 'cutting-edge' },
  { pattern: /\bstate[- ]of[- ]the[- ]art\b/i, word: 'state-of-the-art' },
  { pattern: /\brevolutionize[ds]?\b/i, word: 'revolutionize' },
  { pattern: /\bunlock(s|ed|ing)?\s/i, word: 'unlock (verb)' },
  { pattern: /\bunleash(es|ed|ing)?\b/i, word: 'unleash' },
  { pattern: /\bempower(s|ed|ing|ment)?\b/i, word: 'empower' },
];

// Get tracked files, excluding binary/vendor paths
const EXCLUDE_DIRS = ['node_modules', 'resources', '.git', 'target', 'foundry-out', '.pnpm', 'broadcast', '.forge-cache', '.scratch'];
const EXCLUDE_FILES = [
  'docs/conventions/writing.md', // The convention doc itself lists banned words as examples
  'scripts/check-banned-words.mjs', // This script contains the patterns
];

let files;
try {
  files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !EXCLUDE_DIRS.some((d) => f.startsWith(d + '/') || f.includes('/' + d + '/')))
    .filter((f) => !EXCLUDE_FILES.includes(f.replace(/\\/g, '/')))
    .filter((f) => !/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(f)) // Test files may reference banned words to assert absence
    .filter((f) => /\.(md|tsx?|jsx?|txt|yml|yaml|html|css)$/.test(f));
} catch {
  console.error('✗ git ls-files failed. Run from repo root.');
  process.exit(1);
}

import { readFileSync } from 'node:fs';

let hits = 0;

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, word } of BANNED_PATTERNS) {
      if (pattern.test(lines[i])) {
        console.log(`${file}:${i + 1}: banned word "${word}" — ${lines[i].trim().slice(0, 80)}`);
        hits++;
      }
    }
  }
}

if (hits > 0) {
  console.log(`\n✗ ${hits} banned-word hit(s) found. Fix before merging.`);
  process.exit(1);
} else {
  console.log('✓ No banned words found.');
}
