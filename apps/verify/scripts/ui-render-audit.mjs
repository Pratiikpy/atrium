// Real-user render/visual audit. Visits every page route on the running
// production server, captures console errors, page (error-boundary) errors,
// HTTP status, a full-page screenshot, and scans rendered text for prototype
// mock-numbers that CLAUDE.md forbids shipping as real. Output: a JSON report
// + console summary. Not a unit test, this is the "click every screen like a
// real user" launch-bar pass (render half; wallet flows are a separate pass).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = (process.env.ATRIUM_PORT || '3939').trim();
const BASE = `http://localhost:${PORT}`;
const OUT = join(tmpdir(), 'atrium-audit');
const SHOTS = join(OUT, 'shots');
const REPORT = join(OUT, 'ui-audit.json');
mkdirSync(SHOTS, { recursive: true });

// Page routes (from src/app/**/page.tsx) with dynamic segments resolved to real
// instances probed against the live server.
const ROUTES = [
  '/', '/accessibility', '/agents/marketplace', '/agents/marketplace/augur',
  '/app', '/app/agents', '/app/integrations', '/app/markets', '/app/notifications',
  '/app/onboarding', '/app/portfolio', '/app/portfolio/activity', '/app/reserves',
  '/app/settings', '/app/settings/session-keys', '/app/tax', '/app/trade',
  '/app/transfer', '/app/vault', '/benchmarks', '/beta', '/brand', '/changelog',
  '/chaos', '/cohort', '/cohort/atrium', '/docs', '/docs/adr', '/docs/adr/001',
  '/docs/api', '/docs/deployment', '/docs/glossary', '/docs/honesty',
  '/docs/runbooks', '/docs/runbooks/codex-deploy', '/internal/scribe-health',
  '/lantern', '/lantern/sla', '/learn', '/legal/kyc', '/legal/privacy',
  '/legal/sub-processors', '/legal/terms', '/loadtest', '/manifesto', '/press',
  '/rostrum', '/security', '/security/bounty', '/security/hall-of-fame', '/sla',
  '/team', '/verify/1',
];

// Prototype placeholders that must never render as real (CLAUDE.md red lines).
const MOCK_FLAGS = [
  '$4.20M', '$4.13M', '$2.65M', '$12.3M', '42,392', '42392', '38.4%',
  '37 agents', '7/8 venues', '7 / 8 venues', 'Wintermute', 'Selini', 'Auros',
  'Galaxy Digital', 'lorem ipsum', 'Lorem ipsum',
];

const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };

const safe = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/[\/\[\]]/g, '_'));

const results = [];
const browser = await chromium.launch();

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  // Mobile pass only on the key user surfaces (desktop covers everything).
  const routeSet = vpName === 'mobile'
    ? ['/', '/app', '/app/portfolio', '/app/trade', '/app/vault', '/app/transfer', '/app/agents', '/security', '/brand']
    : ROUTES;

  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  for (const route of routeSet) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    let status = 0;
    try {
      // domcontentloaded (not networkidle): the app polls live data via React
      // Query, so the network never goes idle. Then settle for client render.
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      status = resp ? resp.status() : 0;
      await page.waitForTimeout(1800); // let client data/render settle
    } catch (e) {
      pageErrors.push(`NAV_FAIL: ${String(e).slice(0, 200)}`);
    }
    const shot = `${SHOTS}/${vpName}__${safe(route)}.png`;
    try { await page.screenshot({ path: shot, fullPage: true }); } catch { /* ignore */ }
    let title = '', text = '';
    try { title = await page.title(); } catch { /* */ }
    try { text = (await page.locator('body').innerText()).replace(/\s+/g, ' '); } catch { /* */ }

    const mocks = MOCK_FLAGS.filter((m) => text.includes(m));
    const errorBoundary = /Application error|something went wrong|Internal Server Error|This page could not be found|Unhandled Runtime Error/i.test(text);
    const blank = text.trim().length < 40;

    results.push({
      vp: vpName, route, status,
      consoleErrors: consoleErrors.length, pageErrors: pageErrors.length,
      consoleSample: consoleErrors.slice(0, 3), pageSample: pageErrors.slice(0, 3),
      mocks, errorBoundary, blank, titleLen: title.length, textLen: text.length, shot,
    });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

writeFileSync(REPORT, JSON.stringify(results, null, 2));

// Summary
const bad = results.filter((r) =>
  (r.status && r.status >= 400) || r.pageErrors > 0 || r.mocks.length > 0 || r.errorBoundary || r.blank);
console.log(`\n=== UI RENDER AUDIT: ${results.length} page loads (${ROUTES.length} desktop + mobile subset) ===`);
console.log(`clean: ${results.length - bad.length}   flagged: ${bad.length}\n`);
for (const r of bad) {
  const tags = [];
  if (r.status >= 400) tags.push(`HTTP_${r.status}`);
  if (r.errorBoundary) tags.push('ERROR_BOUNDARY');
  if (r.blank) tags.push('BLANK');
  if (r.pageErrors) tags.push(`pageErr×${r.pageErrors}`);
  if (r.mocks.length) tags.push(`MOCK:${r.mocks.join('|')}`);
  console.log(`  [${r.vp}] ${r.route}  ${tags.join('  ')}`);
  if (r.pageSample.length) console.log(`        ${r.pageSample[0]}`);
}
// Console-error-only routes (lower severity) listed separately
const consoleOnly = results.filter((r) => r.consoleErrors > 0 && !bad.includes(r));
if (consoleOnly.length) {
  console.log(`\n--- console-errors only (${consoleOnly.length}) ---`);
  for (const r of consoleOnly) console.log(`  [${r.vp}] ${r.route}  console×${r.consoleErrors}  ${r.consoleSample[0] || ''}`);
}
console.log(`\nscreenshots: ${SHOTS}   report: ${REPORT}`);
