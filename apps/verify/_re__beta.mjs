// One-page LIVE re-audit of https://www.useatrium.me/beta
// EXPECTED FIX TO CONFIRM: an Atrium wordmark + a serif H1 (brand anchor present).
// Loads desktop (1280x900) + mobile (390x844, isMobile), dismisses cookie banner,
// waits 3s, then gathers concrete evidence:
//   - computed fontFamily of .wordmark (serif check)
//   - presence + computed fontFamily of the H1 (serif check)
//   - document.scrollWidth vs innerWidth (overflow)
//   - innerText (copy/label checks)
//   - clicks a primary button and reads the resulting state/text
// Screenshots both viewports. Cleans up temp dir on the way out.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://www.useatrium.me/beta';
const OUT = join(tmpdir(), 'atrium-re-beta');
rmSync(OUT, { recursive: true, force: true });
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
  await page.waitForTimeout(3000); // let any live query settle

  // --- overflow check ---
  out.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: document.documentElement.scrollWidth - window.innerWidth,
  }));

  // --- BRAND ANCHOR: wordmark serif check ---
  out.wordmark = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('.wordmark, [class*="wordmark"]'),
    ];
    if (!candidates.length) {
      // also try any element whose text is exactly "Atrium"
      const all = [...document.querySelectorAll('a, span, div, h1, p')];
      const atr = all.find((el) => (el.textContent || '').trim() === 'Atrium');
      if (atr) {
        const ff = getComputedStyle(atr).fontFamily;
        return { found: true, via: 'textMatch', tag: atr.tagName, className: atr.className, fontFamily: ff, serif: /serif|Instrument/i.test(ff), italic: getComputedStyle(atr).fontStyle === 'italic' };
      }
      return { found: false };
    }
    const el = candidates[0];
    const cs = getComputedStyle(el);
    return {
      found: true,
      via: 'classMatch',
      tag: el.tagName,
      className: el.className,
      text: (el.textContent || '').trim().slice(0, 40),
      fontFamily: cs.fontFamily,
      serif: /serif|Instrument/i.test(cs.fontFamily),
      italic: cs.fontStyle === 'italic',
    };
  });

  // --- BRAND ANCHOR: serif H1 check ---
  out.h1 = await page.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')];
    if (!h1s.length) return { found: false, count: 0 };
    return {
      found: true,
      count: h1s.length,
      items: h1s.map((h) => {
        const cs = getComputedStyle(h);
        return {
          text: (h.innerText || h.textContent || '').trim().slice(0, 80),
          fontFamily: cs.fontFamily,
          serif: /serif|Instrument|Times/i.test(cs.fontFamily),
          fontSize: cs.fontSize,
          visible: h.offsetParent !== null || cs.position === 'fixed',
        };
      }),
    };
  });

  // --- copy / label scan + em-dash honesty scan ---
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  out.copy = {
    length: bodyText.length,
    hasBeta: /beta/i.test(bodyText),
    firstChars: bodyText.replace(/\s+/g, ' ').slice(0, 220),
  };
  const emDashCount = (bodyText.match(/—/g) || []).length;
  out.emDash = {
    emDashCount,
    samples: emDashCount
      ? [...bodyText.matchAll(/.{0,30}—.{0,30}/g)].slice(0, 6).map((m) => m[0].replace(/\s+/g, ' '))
      : [],
  };

  // --- inventory buttons/links for the click test ---
  out.buttons = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a[role="button"], a.btn, [class*="button"]')];
    return els.slice(0, 12).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || el.textContent || '').trim().slice(0, 40),
      href: el.getAttribute('href') || null,
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
    })).filter((b) => b.text);
  });

  // --- click a primary actionable button (non-nav) and read result text ---
  out.click = { attempted: false };
  try {
    // Prefer an in-page action button (submit/notify/join) over nav links.
    const candidate = page.locator(
      'button:not([disabled]), [role="button"]:not([aria-disabled="true"])'
    ).filter({ hasText: /notify|join|request|submit|sign|get|early|access|waitlist|apply/i }).first();
    if (await candidate.count()) {
      const beforeText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 500);
      const label = (await candidate.innerText().catch(() => '')).trim().slice(0, 40);
      await candidate.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const afterText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 500);
      out.click = {
        attempted: true,
        label,
        changed: beforeText !== afterText,
        newUrl: page.url(),
        afterSnippet: afterText.replace(/\s+/g, ' ').slice(0, 200),
      };
    } else {
      out.click = { attempted: false, reason: 'no in-page action button matched' };
    }
  } catch (e) {
    out.click = { attempted: true, error: String(e).slice(0, 160) };
  }

  // re-load to reset state before screenshot (in case click navigated)
  if (out.click.newUrl && out.click.newUrl !== URL) {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const shot = join(OUT, `beta_${vpName}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  out.shot = shot;
  const shotTop = join(OUT, `beta_${vpName}_top.png`);
  await page.screenshot({ path: shotTop, fullPage: false }).catch(() => {});
  out.shotTop = shotTop;

  report[vpName] = out;
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nSHOTS:', join(OUT, 'beta_desktop_top.png'), '|', join(OUT, 'beta_mobile_top.png'));
