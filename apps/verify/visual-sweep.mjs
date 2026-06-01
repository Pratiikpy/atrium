// Headless visual + data-honesty sweep (QA Layer 6). Visits every route at
// desktop + mobile, captures console errors / page errors / failed requests,
// screenshots, and greps the rendered text for fake-data / placeholder tells.
// Run: node visual-sweep.mjs   (app must be serving on BASE)
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.SWEEP_BASE ?? 'http://localhost:3100';
const SHOTS = process.env.SWEEP_SHOTS ?? 'C:/Users/prate/AppData/Local/Temp/atrium-shots';

const ROUTES = [
  '/', '/manifesto', '/team', '/brand', '/benchmarks', '/security', '/security/bounty',
  '/cohort', '/press', '/changelog', '/sla', '/lantern', '/rostrum', '/docs',
  '/legal/terms', '/legal/privacy',
  '/verify', '/verify/1', '/verify/2', '/verify/3',
  '/app', '/app/portfolio', '/app/vault', '/app/trade', '/app/markets',
  '/app/transfer', '/app/agents', '/app/settings', '/app/onboarding',
];

// Red flags that should never appear in rendered user-facing text.
const RED = [/lorem ipsum/i, /\bTODO\b/, /\[object Object\]/, /undefinedNaN|NaN%|\$NaN/, /placeholder-f[123]/, /0x0000000000000000000000000000000000000000/];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const results = [];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const netFails = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
    page.on('requestfailed', (r) => {
      const u = r.url();
      // ignore expected: analytics, sentry, external that the app degrades on
      if (/sentry|ingest|google|analytics|fonts\./.test(u)) return;
      netFails.push(`${u.replace(BASE, '')} ${r.failure()?.errorText ?? ''}`.slice(0, 120));
    });
    let httpStatus = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      httpStatus = resp?.status() ?? 0;
      await page.waitForTimeout(700);
    } catch (e) {
      pageErrors.push('NAV ' + (e instanceof Error ? e.message : String(e)).slice(0, 120));
    }
    const slug = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
    const shot = `${SHOTS}/${vp.name}__${slug}.png`;
    try { await page.screenshot({ path: shot, fullPage: true }); } catch {}
    let bodyText = '';
    try { bodyText = (await page.locator('body').innerText()).slice(0, 20000); } catch {}
    const flags = RED.filter((re) => re.test(bodyText)).map((re) => re.source);
    results.push({
      route, viewport: vp.name, httpStatus,
      consoleErrors: consoleErrors.length, consoleErrorSample: consoleErrors[0] ?? '',
      pageErrors: pageErrors.length, pageErrorSample: pageErrors[0] ?? '',
      netFails: netFails.length, netFailSample: netFails[0] ?? '',
      redFlags: flags,
      shot,
    });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

// Print compact report
const bad = results.filter((r) => r.httpStatus !== 200 || r.consoleErrors > 0 || r.pageErrors > 0 || r.netFails > 0 || r.redFlags.length > 0);
console.log(`\n=== SWEEP: ${results.length} page-loads (${ROUTES.length} routes x ${VIEWPORTS.length} viewports) ===`);
console.log(`clean: ${results.length - bad.length} | flagged: ${bad.length}\n`);
for (const r of bad) {
  console.log(`[${r.viewport}] ${r.route} (HTTP ${r.httpStatus})` +
    (r.consoleErrors ? ` | console:${r.consoleErrors} (${r.consoleErrorSample})` : '') +
    (r.pageErrors ? ` | pageErr:${r.pageErrors} (${r.pageErrorSample})` : '') +
    (r.netFails ? ` | netFail:${r.netFails} (${r.netFailSample})` : '') +
    (r.redFlags.length ? ` | RED:${r.redFlags.join(',')}` : ''));
}
await writeFile(`${SHOTS}/report.json`, JSON.stringify(results, null, 2));
console.log(`\nshots + report.json in ${SHOTS}`);
