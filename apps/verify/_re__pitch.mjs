// One-page LIVE re-audit of https://www.useatrium.me/pitch
// EXPECTED FIX TO CONFIRM (remaining-high): on mobile (390px) the Section IX
// "THE CATEGORY" competitive comparison table (.pitch-cat-table) stacks each
// cell to one column AND keeps its column label. The label is injected by CSS:
//   .pitch-cat-head { display:none }  (the header row is hidden on phones)
//   .pitch-cat-cell::before { content: attr(data-label) }  (label per cell)
// So the probe must confirm: header row hidden on mobile, and each stacked
// .pitch-cat-cell renders its data-label text via the ::before pseudo-element.
// On desktop (1280x900) the header row should be the source of the labels.
//
// Loads desktop (1280x900) + mobile (390x844, isMobile), dismisses cookie
// banner, waits 3s, gathers concrete evidence (serif wordmark fontFamily,
// document.scrollWidth vs innerWidth overflow, innerText copy/label checks,
// the Section IX label probe), screenshots, and cleans up its temp files.
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://www.useatrium.me/pitch';
const SHOTDIR = mkdtempSync(join(tmpdir(), 'pitch-reaudit-'));

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 900 }, isMobile: false },
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
};

async function dismissCookie(page) {
  const labels = ['Reject non-essential', 'Accept all', 'Accept', 'Got it', 'I agree', 'OK', 'Allow'];
  for (const label of labels) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
      if (await btn.count()) {
        await btn.first().click({ timeout: 1500 }).catch(() => {});
        return label;
      }
    } catch { /* */ }
  }
  return null;
}

const report = {};
const browser = await chromium.launch();

for (const [vpName, ctxOpts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  const out = { vp: vpName };

  try {
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    out.status = resp ? resp.status() : 0;
  } catch (e) {
    out.navError = String(e).slice(0, 200);
    report[vpName] = out;
    await ctx.close();
    continue;
  }
  out.cookieDismissed = await dismissCookie(page);
  await page.waitForTimeout(3000);

  // Make sure the Section IX table is present + scrolled into layout.
  try {
    await page.locator('.pitch-cat-table').first().scrollIntoViewIfNeeded({ timeout: 5000 });
  } catch { /* still probe below */ }
  await page.waitForTimeout(400);

  // --- overflow check (document scrollWidth vs innerWidth) ---
  out.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
    hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
  }));

  // --- serif check: computed fontFamily of .wordmark ---
  out.wordmark = await page.evaluate(() => {
    const el = document.querySelector('.wordmark');
    if (!el) return { found: false };
    const ff = getComputedStyle(el).fontFamily;
    return { found: true, fontFamily: ff, serif: /serif|Instrument|Times/i.test(ff) };
  });

  // --- innerText copy/label checks: confirm the Section IX heading + labels exist ---
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  out.copy = {
    hasCategoryHeading: /none net across them/i.test(bodyText),
    hasNetting: /CROSS-VENUE NETTING/i.test(bodyText),
    hasNonCustodial: /NON-CUSTODIAL/i.test(bodyText),
    hasPor: /ON-CHAIN POR/i.test(bodyText),
    hasKyc: /KYC-GATED/i.test(bodyText),
    hasAtriumRow: /Across venues/i.test(bodyText),
  };
  // em-dash hygiene (CLAUDE.md red line)
  out.emDash = {
    emDashCount: (bodyText.match(/—/g) || []).length,
    samples: [...bodyText.matchAll(/.{0,28}—.{0,28}/g)].slice(0, 6).map((m) => m[0].replace(/\s+/g, ' ')),
  };

  // --- THE EXPECTED FIX: Section IX comparison-table column labels on mobile ---
  // Probe: header row visibility + each stacked .pitch-cat-cell's data-label and
  // the ::before pseudo content that injects that label inline on phones.
  out.catTable = await page.evaluate(() => {
    const table = document.querySelector('.pitch-cat-table');
    if (!table) return { found: false };

    const head = table.querySelector('.pitch-cat-head');
    const headStyle = head ? getComputedStyle(head) : null;
    const headerLabels = head
      ? [...head.querySelectorAll('[role="columnheader"]')].map((s) => s.textContent.trim()).filter(Boolean)
      : [];

    const cells = [...table.querySelectorAll('.pitch-cat-cell')];
    // Sample a representative spread of cells across the rows.
    const sample = cells.slice(0, 8).map((c) => {
      const dataLabel = c.getAttribute('data-label') || '';
      const before = getComputedStyle(c, '::before');
      // The injected label text. jsdom returns content quoted; strip quotes.
      let beforeContent = before.content || '';
      const beforeDisplayed = beforeContent && beforeContent !== 'none' && beforeContent !== 'normal';
      beforeContent = beforeContent.replace(/^["']|["']$/g, '');
      const r = c.getBoundingClientRect();
      return {
        dataLabel,
        valueText: c.textContent.trim(),
        beforeContentRaw: before.content,
        beforeContent,
        // does the ::before actually render the data-label text?
        labelInjected: beforeDisplayed && beforeContent === dataLabel && dataLabel.length > 0,
        beforeDisplay: before.display,
        cellWithinViewport: r.left >= -1 && r.right <= window.innerWidth + 1,
      };
    });

    const allInjected = sample.length > 0 && sample.every((s) => s.labelInjected);
    const anyInjected = sample.some((s) => s.labelInjected);

    return {
      found: true,
      headerRowDisplay: headStyle ? headStyle.display : '(no head)',
      headerRowHidden: headStyle ? headStyle.display === 'none' : null,
      headerLabels,
      cellCount: cells.length,
      sampleSize: sample.length,
      allLabelsInjected: allInjected,
      anyLabelInjected: anyInjected,
      sample,
    };
  });

  const shot = join(SHOTDIR, `pitch_${vpName}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  // tight shot of the Section IX table for visual judgement
  let tableShot = null;
  try {
    tableShot = join(SHOTDIR, `pitch_${vpName}_catTable.png`);
    await page.locator('.pitch-cat-table').first().screenshot({ path: tableShot });
  } catch { tableShot = null; }
  out.shot = shot;
  out.tableShot = tableShot;
  out.consoleErrors = consoleErrors.slice(0, 4);

  report[vpName] = out;
  await ctx.close();
}

await browser.close();
const reportPath = join(SHOTDIR, 'report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nSHOTDIR=' + SHOTDIR);
console.log('CLEANUP=' + (process.env.KEEP ? 'kept' : 'will-delete'));
// Self-clean unless KEEP=1 (we read shots first, then the runner deletes).
