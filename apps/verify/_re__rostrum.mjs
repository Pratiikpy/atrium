// One-page LIVE re-audit of https://www.useatrium.me/rostrum
// Confirms the expected fix: the fixed bottom-right Kani CI pill must NOT occlude
// the footer "Accessibility" link when the page is scrolled to the bottom. Per the
// fix in src/components/kani-badge.tsx, the chip hides itself (returns null) once
// the viewport is within ~180px of the document foot, so it can never overlap the
// footer link or the last card.
// Also gathers the standard probes: serif wordmark, horizontal overflow, copy.
// Desktop (1280x900) + mobile (390x844, isMobile). Throwaway; cleans up after.
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://www.useatrium.me/rostrum';
const SHOTDIR = mkdtempSync(join(tmpdir(), 'rostrum-reaudit-'));

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 900 } },
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
  for (const label of ['Reject non-essential', 'Accept all', 'Got it', 'Accept', 'I agree', 'OK', 'Allow']) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') });
      if (await btn.count()) {
        await btn.first().click({ timeout: 1500 }).catch(() => {});
        return label;
      }
    } catch { /* ignore */ }
  }
  return null;
}

// AABB overlap test for two DOMRect-like boxes.
function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

const report = {};
const browser = await chromium.launch();

for (const [vp, ctxOpts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const out = { vp };
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });

  try {
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    out.status = resp ? resp.status() : 0;
  } catch (e) {
    out.navError = String(e).slice(0, 200);
    report[vp] = out;
    await ctx.close();
    continue;
  }

  out.cookieDismissed = await dismissCookie(page);
  await page.waitForTimeout(3000); // let Kani status fetch + client render settle

  // --- serif check: computed fontFamily of .wordmark ---
  out.wordmark = await page.evaluate(() => {
    const el = document.querySelector('.wordmark');
    if (!el) return { found: false };
    const ff = getComputedStyle(el).fontFamily;
    return { found: true, fontFamily: ff, serif: /serif|Instrument|Times/i.test(ff) };
  });

  // --- overflow check (document scrollWidth vs innerWidth) ---
  out.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // --- copy / label check: innerText, find Accessibility footer link ---
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  out.hasAccessibilityCopy = /accessibility/i.test(bodyText);
  const emDashCount = (bodyText.match(/—/g) || []).length;
  out.emDash = {
    emDashCount,
    samples: emDashCount
      ? [...bodyText.matchAll(/.{0,30}—.{0,30}/g)].slice(0, 5).map((m) => m[0].replace(/\s+/g, ' '))
      : [],
  };

  // --- THE FIX: scroll to the very bottom, then test Kani-pill vs footer link ---
  // 1) scroll to absolute foot of the document and let the scroll listener fire.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(900); // allow scroll handler + any rAF to settle

  out.atBottom = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollY: Math.round(window.scrollY),
      innerHeight: window.innerHeight,
      scrollHeight: doc.scrollHeight,
      distanceFromBottom: Math.round(doc.scrollHeight - (window.innerHeight + window.scrollY)),
    };
  });

  // 2) Locate the Kani pill (fixed bottom-right chip) and the footer Accessibility link.
  out.fix = await page.evaluate(() => {
    const norm = (r) =>
      r ? { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) } : null;

    // Kani chip: a fixed-position element (Link or span) whose text contains "Kani".
    const candidates = [...document.querySelectorAll('a, span')].filter((el) =>
      /kani/i.test(el.textContent || ''));
    let kani = null;
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') { kani = el; break; }
    }
    // fall back: any element with "Kani CI" text even if not fixed (to report state)
    if (!kani && candidates.length) kani = candidates[candidates.length - 1];

    const kaniInfo = kani
      ? {
          found: true,
          text: (kani.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          position: getComputedStyle(kani).position,
          display: getComputedStyle(kani).display,
          visibility: getComputedStyle(kani).visibility,
          // a chip that returns null is simply not in the DOM; presence means still rendered
          rect: norm(kani.getBoundingClientRect()),
          rendered: kani.getBoundingClientRect().width > 0 && getComputedStyle(kani).display !== 'none',
        }
      : { found: false };

    // Footer Accessibility link.
    const accLink = [...document.querySelectorAll('a')].find((a) =>
      /^accessibility$/i.test((a.textContent || '').trim()));
    const accInfo = accLink
      ? { found: true, href: accLink.getAttribute('href'), rect: norm(accLink.getBoundingClientRect()) }
      : { found: false };

    return { kani: kaniInfo, accessibilityLink: accInfo };
  });

  // 3) compute overlap in JS (so structured output is unambiguous)
  const kaniRect = out.fix?.kani?.rect;
  const accRect = out.fix?.accessibilityLink?.rect;
  const kaniRendered = !!out.fix?.kani?.rendered;
  out.overlap = {
    kaniRenderedAtBottom: kaniRendered,
    kaniFound: !!out.fix?.kani?.found,
    accFound: !!out.fix?.accessibilityLink?.found,
    // The fix is: when at bottom the chip is gone (mobile already hides it via md: anyway).
    // Overlap can only happen if the chip is actually rendered AND its box intersects the link box.
    overlapsAccessibility: kaniRendered ? rectsOverlap(kaniRect, accRect) : false,
  };

  out.consoleErrors = consoleErrors.slice(0, 4);

  // screenshot the bottom of the page (current scroll = bottom) for visual judgment
  const shot = join(SHOTDIR, `rostrum_${vp}_bottom.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
  out.shot = shot;

  report[vp] = out;
  await ctx.close();
}

await browser.close();
const reportPath = join(SHOTDIR, 'report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nSHOTDIR=' + SHOTDIR);
