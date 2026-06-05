// Probe the /brand "Inverse, same letterforms" specimen tile on mobile.
// Measures computed text color of the wordmark span + caption, and the card bg.
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.useatrium.me/brand';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
});
const p = await ctx.newPage();
try { await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { console.log('NAV_WARN', String(e).slice(0,80)); }
await new Promise((r) => setTimeout(r, 2500));

const res = await p.evaluate(() => {
  // Find the caption that says "Inverse, same letterforms"
  const caps = [...document.querySelectorAll('p')];
  const cap = caps.find((el) => /inverse, same letterforms/i.test(el.textContent || ''));
  if (!cap) return { found: false };
  const tile = cap.closest('div');
  // wordmark span: the font-display italic "Atrium" sibling
  const word = tile.querySelector('.font-display, [class*="font-display"]') ||
               [...tile.querySelectorAll('span')].find((s) => /atrium/i.test(s.textContent || ''));
  const rgb = (el) => el ? getComputedStyle(el).color : null;
  const bg = (el) => {
    // walk up to find first non-transparent background
    let n = el;
    while (n && n !== document.body) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return { color: c, on: n.className };
      n = n.parentElement;
    }
    return { color: 'none', on: '' };
  };
  return {
    found: true,
    wordmarkText: word ? word.textContent.trim().slice(0, 20) : 'n/a',
    wordmarkColor: rgb(word),
    captionColor: rgb(cap),
    tileClass: tile.className,
    tileBg: getComputedStyle(tile).backgroundColor,
    wordmarkBg: bg(word),
    captionBg: bg(cap),
  };
});

// Also grab the sibling "Light context" tile for comparison
const sib = await p.evaluate(() => {
  const caps = [...document.querySelectorAll('p')];
  const cap = caps.find((el) => /light context/i.test(el.textContent || ''));
  if (!cap) return { found: false };
  const tile = cap.closest('div');
  const word = tile.querySelector('.wordmark') || tile.querySelector('[class*="wordmark"]');
  return {
    found: true,
    wordmarkColor: word ? getComputedStyle(word).color : 'n/a',
    tileBg: getComputedStyle(tile).backgroundColor,
  };
});

console.log('INVERSE TILE:', JSON.stringify(res, null, 2));
console.log('LIGHT-CONTEXT TILE (sibling):', JSON.stringify(sib, null, 2));
await b.close();
