import { chromium } from 'playwright';
const urls = process.argv.slice(2);
const b = await chromium.launch({ headless: true });
for (const url of urls) {
  const p = await b.newPage();
  try {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) { console.log(url, 'NAV', String(e).slice(0,60)); }
  await new Promise((r) => setTimeout(r, 1500));
  const r = await p.evaluate(() => {
    const skip = document.querySelector('a[href="#main-content"]');
    const tgt = document.getElementById('main-content');
    // also find any href="#" dead buttons and onclick-less hash anchors
    const hashEmpty = [...document.querySelectorAll('a[href="#"]')].length;
    return {
      hasSkipLink: !!skip,
      skipText: skip ? (skip.textContent || '').trim().slice(0, 30) : null,
      mainContentExists: !!tgt,
      mainContentTag: tgt ? tgt.tagName.toLowerCase() : null,
      hrefHashCount: hashEmpty,
    };
  });
  console.log(url, JSON.stringify(r));
  await p.close();
}
await b.close();
