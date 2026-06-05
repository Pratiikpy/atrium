import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('https://www.useatrium.me/docs/api', { waitUntil: 'networkidle', timeout: 45000 });
await new Promise(r => setTimeout(r, 3500));
// grab the eyebrow row text + badge classes
const info = await p.evaluate(() => {
  const eyebrowRow = document.querySelector('section.mt-16 .flex.flex-wrap.items-center.gap-3');
  const badge = document.querySelector('section.mt-16 span.inline-flex');
  const dot = badge ? badge.querySelector('span[aria-hidden]') : null;
  return {
    rowText: eyebrowRow ? eyebrowRow.innerText.replace(/\n/g,' | ') : 'NOT FOUND',
    badgeText: badge ? badge.innerText : 'NO BADGE',
    dotClass: dot ? dot.className : 'NO DOT',
    dotColor: dot ? getComputedStyle(dot).backgroundColor : 'n/a',
  };
});
console.log(JSON.stringify(info, null, 2));
// screenshot just the hero section
const sec = await p.$('section.mt-16');
if (sec) await sec.screenshot({ path: '_vf_hero.png' });
await b.close();
