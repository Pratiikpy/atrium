// Live re-audit of ONE page: https://www.useatrium.me/docs/api
//
// Confirms the expected fix on the LIVE production site:
//   1. Try-it on the margin endpoint -> friendly connect/sign-in message,
//      NOT a raw 401 JSON body ({"error":"unauthorized"} / similar).
//   2. The Try-it caption mentions the session/signed-in requirement.
//   3. No $12.3M (or sibling prototype placeholder) anywhere on the page.
//
// Also gathers strict, concrete page-health signals:
//   - .wordmark computed fontFamily (serif / Instrument Serif check)
//   - document.scrollWidth vs window.innerWidth (horizontal overflow)
//   - innerText for copy/label checks
// on BOTH desktop (1280x900) and mobile (390x844, isMobile).
//
// Run from apps/verify:  node _re__docs_api.mjs
import { chromium } from 'playwright';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://www.useatrium.me/docs/api';
const TMP = mkdtempSync(join(tmpdir(), 're-docs-api-'));

// Prototype placeholders that must never render as real (CLAUDE.md red lines).
const MOCK_FLAGS = [
  '$12.3M', '$12.3 M', '$4.20M', '$4.13M', '$2.65M', '42,392', '42392',
  '37 agents', '7/8 venues', 'Wintermute', 'Selini', 'Auros', 'Galaxy Digital',
];

// Signs the result is a raw API error body, not a human-friendly message.
const RAW_401_SIGNS = [
  '"error"', "'error'", 'unauthorized', 'Unauthorized', 'SIWE', 'siwe',
  '401', 'not authenticated', 'No session', 'no session cookie', '{"',
];

const VIEWPORTS = {
  desktop: { name: 'desktop', viewport: { width: 1280, height: 900 }, isMobile: false },
  mobile: { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const out = {};
const browser = await chromium.launch();

for (const cfg of Object.values(VIEWPORTS)) {
  const ctx = await browser.newContext({
    viewport: cfg.viewport,
    isMobile: cfg.isMobile,
    hasTouch: cfg.hasTouch || false,
    deviceScaleFactor: cfg.deviceScaleFactor || 1,
    userAgent: cfg.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();
  const rec = { httpStatus: 0, consoleErrors: [], pageErrors: [] };
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 240)));

  // Load page.
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  rec.httpStatus = resp ? resp.status() : 0;

  // Dismiss any cookie/consent button (best-effort, several common labels).
  for (const label of ['Accept', 'Accept all', 'Got it', 'I agree', 'Allow', 'OK', 'Dismiss']) {
    try {
      const b = page.getByRole('button', { name: new RegExp(`^\\s*${label}\\s*$`, 'i') });
      if (await b.count()) { await b.first().click({ timeout: 1500 }); break; }
    } catch { /* none */ }
  }

  await page.waitForTimeout(3000);

  // --- Serif / wordmark font check ---
  rec.wordmarkFont = await page.evaluate(() => {
    const el = document.querySelector('.wordmark')
      || document.querySelector('[class*="wordmark"]')
      || document.querySelector('h1');
    if (!el) return null;
    return {
      tag: el.tagName,
      cls: el.className?.toString?.().slice(0, 80) || '',
      fontFamily: getComputedStyle(el).fontFamily,
      fontStyle: getComputedStyle(el).fontStyle,
    };
  });

  // --- Horizontal overflow ---
  rec.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // --- Page copy + caption check ---
  const bodyText = (await page.locator('body').innerText()).replace(/ /g, ' ');
  const bodyFlat = bodyText.replace(/\s+/g, ' ');
  rec.mocks = MOCK_FLAGS.filter((m) => bodyFlat.includes(m));
  // Caption: the Try-it helper text must name the signed-in/session requirement.
  rec.captionMentionsSession = /signed.?in|session|connected/i.test(bodyFlat)
    && /margin|positions|per-user|account/i.test(bodyFlat);
  rec.captionSnippet = (bodyFlat.match(/Calls the local testnet[^.]*\.[^.]*\.[^.]*\./i) || [''])[0].slice(0, 320);

  // --- Try-it: select margin endpoint, fill wallet, click, read result ---
  rec.tryIt = { ran: false };
  try {
    const select = page.locator('select[aria-label="Codex endpoint"]');
    if (await select.count()) {
      // Choose the margin endpoint (value="margin").
      await select.selectOption('margin').catch(async () => {
        await select.selectOption({ label: /margin/i }).catch(() => {});
      });
      await page.waitForTimeout(300);
      // Fill a syntactically valid wallet so it passes client validation and
      // actually hits the SIWE-gated mirror route (forcing the 401 path).
      const walletInput = page.locator('input[aria-label="Wallet address"]');
      if (await walletInput.count()) {
        await walletInput.fill('0x1111111111111111111111111111111111111111');
      }
      const tryBtn = page.getByRole('button', { name: /^\s*Try it\s*$/i });
      await tryBtn.first().click({ timeout: 5000 });
      // Wait for either the error <p> or the result <pre> to appear.
      await page.waitForTimeout(4000);
      rec.tryIt.ran = true;

      // The friendly message renders in <p class="...text-neg">; the raw JSON
      // (if regressed) would render in the result <pre>.
      const errP = page.locator('p.text-neg, p[class*="text-neg"]');
      const resultPre = page.locator('pre[class*="overflow-auto"]');
      rec.tryIt.errorText = (await errP.count()) ? (await errP.first().innerText()).trim() : '';
      rec.tryIt.resultText = (await resultPre.count()) ? (await resultPre.first().innerText()).trim().slice(0, 400) : '';

      // Combined visible Try-it output (whichever rendered).
      const shown = rec.tryIt.errorText || rec.tryIt.resultText;
      rec.tryIt.shown = shown;
      rec.tryIt.mentionsConnectOrSignIn = /sign\s?in|signed.?in|connect|session/i.test(shown);
      // A regression would dump a raw JSON / 401 body into the visible output.
      rec.tryIt.looksLikeRaw401 =
        (!!rec.tryIt.resultText && /"error"|unauthorized|401/i.test(rec.tryIt.resultText))
        || /^\s*\{/.test(shown);
    } else {
      rec.tryIt.note = 'Try-it select not found on page';
    }
  } catch (e) {
    rec.tryIt.error = String(e).slice(0, 200);
  }

  // Screenshot of the Try-it area for a visual sanity check.
  const shot = join(TMP, `docs-api-${cfg.name}.png`);
  try { await page.screenshot({ path: shot, fullPage: false }); rec.shot = shot; } catch { /* */ }

  out[cfg.name] = rec;
  await ctx.close();
}
await browser.close();

const reportPath = join(TMP, 'report.json');
writeFileSync(reportPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\nREPORT:', reportPath);
console.log('TMPDIR:', TMP);
