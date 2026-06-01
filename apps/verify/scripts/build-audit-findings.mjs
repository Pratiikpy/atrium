#!/usr/bin/env node
/**
 * build-audit-findings.mjs
 *
 * Phase theta.2 fix (2026-05-25). Pre-fix the verify-app's
 * /api/audit-findings route parsed docs/AUDIT_FINDINGS.md at request
 * time via `node:fs/promises`. On Vercel the file is not packaged
 * into the serverless bundle (process.cwd() = /var/task; docs/ lives
 * outside the Next.js project root), so every production request
 * returned an empty `findings: []` array with `source: 'pending'` -
 * silently displaying "no audit findings" while the markdown
 * register lists 200+ rows.
 *
 * Now: a build-time step parses the markdown ONCE and writes a JSON
 * file to apps/verify/public/audit-findings.json. The route reads
 * the static file. Markdown stays the source of truth; the JSON is
 * a regenerable derivative shipped with each deploy.
 *
 * Runs as a prebuild hook (see package.json:scripts.prebuild) so
 * Vercel + local + CI all get the regeneration for free.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MD_PATH = path.join(REPO_ROOT, 'docs', 'AUDIT_FINDINGS.md');
const OUT_PATH = path.join(__dirname, '..', 'public', 'audit-findings.json');

function stripMd(s) {
  return s.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

async function main() {
  let text;
  try {
    text = await readFile(MD_PATH, 'utf8');
  } catch (err) {
    // Repo-root fallback in case the script is invoked from a worktree.
    console.warn(`[audit-findings] could not read ${MD_PATH}: ${err.message}`);
    text = '';
  }

  const findings = [];
  for (const line of text.split(/\r?\n/)) {
    // Register table row: `| 42 | finding | A | path:line | F1 | target | status |`
    const m = line.match(/^\|\s*(\d+)\s*\|(.+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const cells = m[2].split('|').map((c) => c.trim());
    if (cells.length < 6) continue;
    const [finding, agent, location, owner, target, statusRaw] = cells;
    const status = /✅|done|closed|patched|fixed/i.test(statusRaw) ? 'closed' : 'pending';
    const statusDetail = stripMd(statusRaw).replace(/^[✅🟡]+\s*/, '');
    findings.push({
      id,
      finding: stripMd(finding),
      agent: stripMd(agent),
      location: stripMd(location),
      owner: stripMd(owner),
      target: stripMd(target),
      status,
      statusDetail: statusDetail || undefined,
    });
  }

  const summary = {
    total: findings.length,
    closed: findings.filter((f) => f.status === 'closed').length,
    pending: findings.filter((f) => f.status === 'pending').length,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        findings,
        summary,
        source: findings.length > 0 ? 'docs' : 'pending',
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  console.log(
    `[audit-findings] wrote ${findings.length} findings ` +
      `(${summary.closed} closed / ${summary.pending} pending) to ${OUT_PATH}`,
  );
}

main().catch((err) => {
  console.error('[audit-findings] failed:', err);
  process.exit(1);
});
