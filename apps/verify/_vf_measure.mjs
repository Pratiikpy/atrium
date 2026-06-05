import { chromium } from 'playwright';
const url = 'https://www.useatrium.me/app/portfolio';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
});
const p = await ctx.newPage();
try { await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { console.log('NAV_WARN', String(e).slice(0,80)); }
await new Promise(r => setTimeout(r, 3000));
const data = await p.evaluate(() => {
  const out = [];
  // find anchor links whose trimmed text is "All"
  document.querySelectorAll('a').forEach(a => {
    const t = (a.textContent || '').trim();
    if (t === 'All' || t === 'Open one') {
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      out.push({
        text: t,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        padTop: cs.paddingTop, padBottom: cs.paddingBottom,
        padLeft: cs.paddingLeft, padRight: cs.paddingRight,
        fontSize: cs.fontSize,
        display: cs.display,
      });
    }
  });
  return out;
});
console.log(JSON.stringify(data, null, 2));
await b.close();
