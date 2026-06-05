// One-page LIVE re-audit of https://www.useatrium.me/learn
// Primary fix to confirm: Lantern copy says "Every 10 minutes" (NOT hourly).
// Loads desktop (1280x900) + mobile (390x844, isMobile), dismisses cookie
// banner, waits 3s, gathers concrete evidence, screenshots, cleans up after.
//
// /learn is a static marketing page (MarketingShell). It has no chaos/docs-api
// buttons, no security table, and no rostrum Kani pill, so those probes from the
// generic template are reported as not-applicable here. We instead check:
//   - Lantern copy: "Every 10 minutes" present, "hourly"/"every hour" absent
//   - .wordmark computed fontFamily (serif check)
//   - document.scrollWidth vs innerWidth (horizontal overflow)
//   - em-dash scan in innerText (writing.md banned char)
//   - all six Step bodies' copy
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://www.useatrium.me/learn';
const OUT = join(tmpdir(), 'atrium-re-learn');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1280, height: 900, isMobile: false },
  mobile: { width: 390, height: 844, isMobile: true },
};

async function dismissCookie(page) {
  const labels = ['Accept', 'Accept all', 'Got it', 'I agree', 'OK', 'Allow'];
  for (const label of labels) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') });
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

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    deviceScaleFactor: vp.isMobile ? 2 : 1,
    hasTouch: vp.isMobile,
  });
  const page = await ctx.newPage();
  const out = { vp: vpName };

  try {
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    out.status = resp ? resp.status() : 0;
  } catch (e) {
    out.navError = String(e).slice(0, 200);
  }
  out.cookieDismissed = await dismissCookie(page);
  await page.waitForTimeout(3000);

  // --- overflow check ---
  out.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // --- serif check: computed fontFamily of .wordmark ---
  out.wordmark = await page.evaluate(() => {
    const el = document.querySelector('.wordmark');
    if (!el) return { found: false };
    const ff = getComputedStyle(el).fontFamily;
    return { found: true, fontFamily: ff, serif: /serif|Instrument/i.test(ff) };
  });

  // --- innerText copy/label checks ---
  const bodyText = await page.evaluate(() => document.body.innerText || '');

  // PRIMARY FIX: Lantern cadence copy
  // Grab the "proves reserves" step body straight from the DOM in the browser.
  const lanternStepBody = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('h3')];
    const h = heads.find((x) => /proves reserves/i.test(x.textContent || ''));
    if (!h) return null;
    const p = h.parentElement ? h.parentElement.querySelector('p:last-child') : null;
    return p ? p.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  out.lantern = {
    has10min: /every\s*10\s*minutes/i.test(bodyText),
    hasHourly: /hourly|every\s*hour|once\s*an?\s*hour/i.test(bodyText),
    // pull the exact Lantern sentence for the record
    sentence: (() => {
      const m = bodyText.match(/[^.]*Lantern[^.]*\./i)
        || bodyText.match(/Every\s*10\s*minutes[^.]*\./i);
      return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 220) : null;
    })(),
    stepBody: lanternStepBody,
  };

  // em-dash scan
  const emDashCount = (bodyText.match(/—/g) || []).length;
  const enDashCount = (bodyText.match(/–/g) || []).length;
  out.emDash = {
    emDashCount,
    enDashCount,
    emDashSamples: emDashCount
      ? [...bodyText.matchAll(/.{0,30}—.{0,30}/g)].slice(0, 8).map((m) => m[0].replace(/\s+/g, ' '))
      : [],
  };

  // --- all six Step headings + bodies for a copy sanity pass ---
  out.steps = await page.evaluate(() =>
    [...document.querySelectorAll('h3')].map((h) => {
      const p = h.parentElement ? h.parentElement.querySelector('p:last-child') : null;
      return {
        title: (h.textContent || '').trim(),
        body: p ? p.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
      };
    }),
  );

  // --- not-applicable probes from the generic template, recorded honestly ---
  out.notApplicable = await page.evaluate(() => ({
    chaosButton: document.querySelectorAll('button').length, // count only; /learn has none expected
    securityTable: document.querySelectorAll('table').length,
    kaniPill: [...document.querySelectorAll('*')].some((e) => /kani/i.test(e.textContent || '')),
  }));

  // h1 present + page heading
  out.h1 = await page.evaluate(() => {
    const h = document.querySelector('h1');
    return h ? h.textContent.trim() : null;
  });

  const shot = join(OUT, `learn_${vpName}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  out.shot = shot;

  report[vpName] = out;
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nSHOTS:', join(OUT, 'learn_desktop.png'), '|', join(OUT, 'learn_mobile.png'));
