import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-19: cross-page fragment links (`/learn#adapters`, `/security
 * #audit-findings-register`, etc.) had no matching `id=` attributes
 * anywhere in the codebase, so clicking them landed silently at the top
 * of the destination page. This test enumerates every `href="…#anchor"`
 * in the source tree and asserts the corresponding `id="anchor"` exists
 * on the target page.
 *
 * Scope: only checks anchors that point at routes inside this verify app
 * (`/learn`, `/security`, etc.). Cross-domain anchors and same-page
 * anchors are out of scope.
 */

const REPO_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

interface CrossPageAnchor {
  source: string;
  href: string;
  targetRoute: string;
  anchor: string;
}

function findCrossPageAnchors(): CrossPageAnchor[] {
  const out: CrossPageAnchor[] = [];
  const anchorRegex = /href=(?:"|\{['"])(\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)#([a-zA-Z0-9_-]+)(?:"|['"]\})/g;
  for (const file of walk(REPO_SRC)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(anchorRegex)) {
      out.push({ source: file, href: m[0], targetRoute: m[1], anchor: m[2] });
    }
  }
  return out;
}

function pageFileForRoute(route: string): string | null {
  const candidate = join(REPO_SRC, 'app', route.slice(1), 'page.tsx');
  try {
    statSync(candidate);
    return candidate;
  } catch {
    return null;
  }
}

describe('cross-page fragment anchors resolve to real ids', () => {
  it('every /<page>#<id> link has a matching id="..." on the target page', () => {
    const anchors = findCrossPageAnchors();
    expect(anchors.length).toBeGreaterThan(0);
    const broken: string[] = [];
    for (const a of anchors) {
      const target = pageFileForRoute(a.targetRoute);
      if (!target) {
        broken.push(`${a.source} → ${a.href} (target page missing: ${a.targetRoute})`);
        continue;
      }
      const txt = readFileSync(target, 'utf8');
      const idPatterns = [
        new RegExp(`id=["']${a.anchor}["']`),
        new RegExp(`id=\\{["']${a.anchor}["']\\}`),
      ];
      if (!idPatterns.some((p) => p.test(txt))) {
        broken.push(`${a.source} → ${a.href} (no id="${a.anchor}" in ${a.targetRoute})`);
      }
    }
    expect(broken).toEqual([]);
  });
});
