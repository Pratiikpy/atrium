import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3];
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2500));
// dismiss cookie banner
await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(b=>/accept all|reject non/i.test(b.textContent||''));if(x)x.click();}).catch(()=>{});
await new Promise(r=>setTimeout(r,800));
// scroll a bit so we're mid-page (not near bottom) where badge is visible
await p.evaluate(()=>window.scrollTo(0, 600));
await new Promise(r=>setTimeout(r,1200));
// measure the badge
const badge = await p.evaluate(()=>{
  const els=[...document.querySelectorAll('a,span')];
  const m=els.find(e=>/Kani CI/.test(e.textContent||'')&&getComputedStyle(e).position==='fixed');
  if(!m) return null;
  const r=m.getBoundingClientRect();
  const cs=getComputedStyle(m);
  return {text:m.textContent.trim(), x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height), pos:cs.position, z:cs.zIndex, display:cs.display, href:m.getAttribute('href')};
});
await p.screenshot({path:out});
console.log(JSON.stringify({badge}));
await b.close();
