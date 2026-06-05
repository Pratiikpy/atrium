import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('https://www.useatrium.me/', { waitUntil: 'networkidle', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
const imp = p.locator('.impluvium').first();
await imp.scrollIntoViewIfNeeded();
await imp.screenshot({ path: 'C:/Users/prate/Downloads/arb builder/apps/verify/.tmp_audit/vf_imp.png' });
// also capture the real $9.96 live stat block for proximity comparison
const liveTxt = await p.locator('text=/read from Scribe/i').first().innerText().catch(() => 'n/a');
console.log('live stat text:', liveTxt.slice(0, 120));
await b.close();
