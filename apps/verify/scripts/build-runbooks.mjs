#!/usr/bin/env node
/**
 * build-runbooks.mjs
 *
 * Generates a bundled JSON of the repo's operational runbooks (runbooks/*.md)
 * so /docs/runbooks can render them. Same Vercel-safety reasoning as
 * build-audit-findings.mjs: files outside the Next.js project root are not
 * packaged into the serverless bundle, and reading them with fs at request
 * time returns empty in production. Emitting an importable JSON under
 * src/lib/generated/ guarantees the content is bundled.
 *
 * Markdown stays the source of truth in runbooks/; this JSON is a regenerable
 * derivative produced at build time (prebuild hook) and committed so dev works
 * without running the build first.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNBOOKS_DIR = path.join(REPO_ROOT, 'runbooks');
const OUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'generated', 'runbooks.json');

function titleFromSlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** First h1 as title, first plain paragraph as summary. */
function extract(md, fallbackTitle) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title = fallbackTitle;
  let summary = '';
  let sawH1 = false;
  for (const raw of lines) {
    const line = raw.trim();
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1 && !sawH1) {
      title = h1[1].trim();
      sawH1 = true;
      continue;
    }
    if (
      sawH1 &&
      line !== '' &&
      !line.startsWith('#') &&
      !line.startsWith('>') &&
      !line.startsWith('|') &&
      !line.startsWith('```') &&
      !line.startsWith('-') &&
      !/^\d+\./.test(line)
    ) {
      summary = line.replace(/[*_`[\]]/g, '').replace(/\(([^)]*)\)/g, '').trim();
      break;
    }
  }
  return { title, summary };
}

function category(slug) {
  if (slug.startsWith('incident-')) return 'Incident response';
  if (/(deploy|droplet|caddy|dns|vercel|env|launch|soft-launch|smoke)/.test(slug)) return 'Deploy & launch';
  if (/(key|rotation|pgp)/.test(slug)) return 'Keys & security';
  if (/(sentry|new-relic|honeybadger|status-page|alerts|on-call|discord)/.test(slug)) return 'Monitoring & on-call';
  return 'Setup & accounts';
}

/**
 * Fail-closed publish allowlist. /docs/runbooks is a PUBLIC route, so only
 * runbooks that are safe for a public audience are bundled. Operational
 * runbooks (infra topology, secret-key names, on-call handles, incident
 * playbooks) are internal-only: they are gitignored + removed from the repo,
 * and even if one reappears under runbooks/ it will NOT be published unless its
 * filename is added here on purpose. Public-repo audit 2026-06-05.
 */
const PUBLIC_ALLOWLIST = new Set([
  'deploy.md',
  'incident-response.md',
  'browserstack-setup.md',
]);

async function main() {
  let files = [];
  try {
    files = (await readdir(RUNBOOKS_DIR))
      .filter((f) => f.endsWith('.md') && PUBLIC_ALLOWLIST.has(f))
      .sort();
  } catch (err) {
    console.warn(`[runbooks] could not read ${RUNBOOKS_DIR}: ${err.message}`);
  }

  const runbooks = [];
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    let markdown = '';
    try {
      markdown = await readFile(path.join(RUNBOOKS_DIR, file), 'utf8');
    } catch {
      continue;
    }
    const { title, summary } = extract(markdown, titleFromSlug(slug));
    runbooks.push({ slug, title, summary, category: category(slug), markdown });
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        runbooks,
        count: runbooks.length,
        source: runbooks.length > 0 ? 'runbooks' : 'pending',
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`[runbooks] wrote ${runbooks.length} runbooks to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('[runbooks] failed:', err);
  process.exit(1);
});
