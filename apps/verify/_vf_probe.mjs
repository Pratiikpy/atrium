import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
const p = await ctx.newPage();
await p.goto('https://www.useatrium.me/app/trade', { waitUntil: 'networkidle', timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));
const r = await p.evaluate(() => {
  const cta = [...document.querySelectorAll('button')].find(b => /Open long|Open short/.test(b.textContent||''));
  const longToggle = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Long');
  const cs = cta ? getComputedStyle(cta) : null;
  const ls = longToggle ? getComputedStyle(longToggle) : null;
  return {
    cta: cta ? { text: cta.textContent.trim(), disabled: cta.disabled, ariaDisabled: cta.getAttribute('aria-disabled'),
      bg: cs.backgroundColor, opacity: cs.opacity, cursor: cs.cursor, className: cta.className } : 'NOT FOUND',
    longToggle: ls ? { bg: ls.backgroundColor, opacity: ls.opacity } : 'NOT FOUND',
    helperText: (() => { const ps=[...document.querySelectorAll('p')].map(x=>x.textContent.trim()).filter(Boolean);
      return ps.filter(t=>/pending|connect|deploy|amount|enter|ready/i.test(t)).slice(0,6); })(),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
