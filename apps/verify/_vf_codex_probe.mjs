import { chromium } from 'playwright';
const url = 'https://www.useatrium.me/docs/api';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 1200 } });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// wait for the hero badge to leave "checking" state
await p.waitForTimeout(4000);
const hero = await p.locator('text=/Codex worker/i').first().innerText().catch(()=>'(not found)');
// collect endpoint badge labels (the pill after pricing): look for 'live'/'pending' pills
const badges = await p.locator('article span.rounded-full').allInnerTexts().catch(()=>[]);
console.log('HERO:', JSON.stringify(hero));
console.log('ENDPOINT_BADGES:', JSON.stringify(badges));
await b.close();
