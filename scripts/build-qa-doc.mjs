#!/usr/bin/env node
/**
 * One-off assembler: turns the QA-enumeration workflow output + a live scan of
 * the app routes into docs/QA_LAUNCH_READINESS.md. Authored framing (intro,
 * setup, design/a11y, GO/NO-GO gate, sign-off) is inline; the 565 scripted
 * test cases are transformed faithfully from the workflow JSON; every page and
 * API route is listed in a coverage table so nothing is missed.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_JSON = process.argv[2];
const APP_DIR = 'apps/verify/src/app';
const DOC_PATH = 'QA_LAUNCH_READINESS.md';
const TICK = String.fromCharCode(96);
const cc = (s) => TICK + s + TICK; // inline code span

const { result } = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
const sections = result.sections || [];
const critic = result.critic || {};

const SEV = { blocker: 'BLOCKER', high: 'HIGH', medium: 'MED', low: 'LOW' };

function unesc(s) {
  return String(s ?? '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[—–]/g, '-'); // em/en dash -> hyphen (writing.md rule)
}
const prose = (s) => unesc(s).replace(/\s+/g, ' ').trim();
const cell = (s) => prose(s).replace(/\|/g, '\\|'); // escape pipes inside table cells

// ---- live route scan ----
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
const files = walk(APP_DIR);
function pageRoute(f) {
  let rel = f.split(APP_DIR + '/')[1].replace(/\/page\.tsx$/, '');
  rel = rel.split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
  return rel === '' ? '/' : '/' + rel;
}
function apiRoute(f) {
  const rel = f.split(APP_DIR + '/')[1].replace(/\/route\.ts$/, '');
  return '/' + rel;
}
const pages = [...new Set(files.filter((f) => /\/page\.tsx$/.test(f)).map(pageRoute))].sort();
const apis = [...new Set(files.filter((f) => /\/api\/.*\/route\.ts$/.test(f)).map(apiRoute))].sort();

// which routes have a deep scripted group?
const deepPages = new Set();
const deepApis = new Set();
for (const sec of sections) {
  for (const g of sec.testGroups || []) {
    const t = (g.title || '') + ' ' + (g.location || '');
    const pm = t.match(/\/[A-Za-z0-9_\-\[\]/]+/g) || [];
    for (const m of pm) {
      if (m.startsWith('/api/')) deepApis.add(m);
      else if (pages.includes(m)) deepPages.add(m);
    }
  }
}

// ---- render helpers ----
function renderGroup(g, idx) {
  const lines = [];
  lines.push(`#### ${idx} ${prose(g.title)}`);
  if (g.location) lines.push(`*Where:* ${cc(prose(g.location).replace(/\\/g, '/').replace(/^.*\/apps\/verify/, 'apps/verify'))}`);
  if (g.purpose) lines.push(`*Purpose:* ${prose(g.purpose)}`);
  lines.push('');
  const tcs = g.testCases || [];
  if (tcs.length) {
    lines.push('| # | Do this | Expect (premium = correct) | Sev | Pass |');
    lines.push('|---|---------|----------------------------|-----|------|');
    tcs.forEach((tc, i) => {
      lines.push(`| ${i + 1} | ${cell(tc.action)} | ${cell(tc.expected)} | ${SEV[tc.severity] || tc.severity} | [ ] |`);
    });
    lines.push('');
  }
  if ((g.statesToVerify || []).length) lines.push(`*States to verify:* ${g.statesToVerify.map(prose).join(' / ')}`);
  if ((g.flawsToHuntFor || []).length) {
    lines.push('*Hunt for these flaws:*');
    for (const f of g.flawsToHuntFor) lines.push(`- ${prose(f)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderSection(sec, heading) {
  const out = [`## ${heading}`, ''];
  if (sec.summary) out.push(`> ${prose(sec.summary)}`, '');
  let n = 1;
  for (const g of sec.testGroups || []) out.push(renderGroup(g, `${heading.split('.')[0]}.${n++}`));
  return out.join('\n');
}

const byDim = {};
for (const s of sections) byDim[s.dimension] = s;
function find(...keys) {
  for (const k of Object.keys(byDim)) {
    const lk = k.toLowerCase();
    if (keys.some((kk) => lk.includes(kk))) return byDim[k];
  }
  return { testGroups: [] };
}

// ---- coverage tables ----
function covTable(routes, deep, refSection) {
  const rows = routes.map((r) => `| ${cc(r)} | ${deep.has(r) ? 'Deep - see ' + refSection : 'Smoke pass (apply the Global checklist in S1)'} | [ ] |`);
  return ['| Route | Coverage | Pass |', '|-------|----------|------|', ...rows].join('\n');
}

// ============================ DOC ============================
const D = [];
D.push(`# Atrium - Launch-Readiness QA Test Plan

> One pass, top to bottom. **Every item must pass** (or be a written, accepted exception) before we call Atrium launch-ready. The bar is premium: a real person should be able to do everything end to end, see only honest data, and never hit a dead button, a fake number, a broken state, or a sloppy screen.

Generated **2026-05-29** from the live codebase: **${pages.length} pages**, **${apis.length} API routes**, **${sections.reduce((n, s) => n + (s.testGroups || []).reduce((m, g) => m + (g.testCases || []).length, 0), 0)} scripted checks** across 8 dimensions, plus a completeness critic pass.

---

## S0. How to use this document

- Go in order. Tick the **Pass** box when an item behaves exactly as **Expect** describes. If it does not, log it (screenshot + page + step number + what you saw) and mark the severity.
- **Severity key:** **BLOCKER** = not launch-ready until fixed. **HIGH** = fix before launch. **MED** = fix soon after. **LOW** = polish.
- Test **both axes** on every screen: it must **work** (the action does what it says) **and** it must look/read **premium** (typography, spacing, copy, calm prime-brokerage feel - never generic).
- **The honesty rule (hard, non-negotiable):** no screen may present a fabricated number as real. Every figure is either real (from the subgraph/chain/an API) or an honest ${cc('pending')} / ${cc('0')} / ${cc('not indexed yet')} / disabled state. If you cannot tell where a number came from, that itself is a finding.
- A surface is only "done" when its loading, empty, error, permission, success, **and** mobile states are all correct - not just the happy path.

## S1. Global checklist - apply to EVERY page

Run these on every route before the page-specific tests. Any failure is at least HIGH.

| # | Do this on the page | Expect | Sev | Pass |
|---|---------------------|--------|-----|------|
| 1 | Open the route fresh (hard reload) | Renders within ~2s, no white flash, no layout shift as data loads | HIGH | [ ] |
| 2 | Open DevTools console | Zero errors, zero React warnings, no failed network calls rendered as success | HIGH | [ ] |
| 3 | Watch the first paint while data loads | A real loading/skeleton state shows - never a flash of fake/zero numbers | BLOCKER | [ ] |
| 4 | If the page shows data with nothing to show | Honest empty state with a clear next action - never "No data" with a dead end, never fake filler | BLOCKER | [ ] |
| 5 | Kill the network / force an API failure | A clear error state with a retry or honest "pending" - never a silent hang or a frozen form | HIGH | [ ] |
| 6 | Resize to 375px (mobile), 768px (tablet), 1280px (desktop) | Layout reflows cleanly at each; no overflow, overlap, clipped text, or horizontal scroll | HIGH | [ ] |
| 7 | Tab through with the keyboard only | Every control is reachable, focus ring is visible, order is logical, Enter/Space activate | HIGH | [ ] |
| 8 | Read every word on the page | Cofounder voice, no banned marketing words, no typos, no em-dashes, no lorem/placeholder | MED | [ ] |
| 9 | Check the browser tab | Correct page title + favicon (the breathing status tile) | LOW | [ ] |
| 10 | Click every button / link | Each does something real or is honestly disabled with a reason - zero dead controls | BLOCKER | [ ] |

## S2. Setup before you start

- **Where to run it:** locally, start the app and open ${cc('http://localhost:3000')} (the verify app under ${cc('apps/verify')}); or use the deployed site once it is published. The local subgraph URL is already wired in ${cc('apps/verify/.env.local')} to the v0.0.7 endpoint.
- **Wallet:** a browser wallet (Rabby or MetaMask) set to **Arbitrum Sepolia (chain 421614)**.
- **Test funds:** use the in-app **Faucet** (test USDC + a little ETH, 24h cooldown). For extra gas, a public Arbitrum Sepolia faucet.
- **Live numbers are syncing:** TVL / counts come from the subgraph **v0.0.7**, which is still indexing. Early on some tiles read ${cc('pending')} - that is **correct**, not a bug. Re-check after it catches up.
- **Testable now vs after the timelock (important):** opening a **cross-venue position** (and anything that routes funds through Coffer to an adapter) unlocks only **after the timelock executes (~2026-05-31 02:20 UTC)**. Until then, the correct behavior is that "open position" is **cleanly gated/disabled with an honest message** - so test that it is gated gracefully, *not* that it trades. **Everything else is testable today:** login, faucet, vault deposit/withdraw, portfolio reads, reserves, transfers UI, agents/mandate UI, all reads, all copy, all design, all states.

---
`);

// 1. Pages
D.push(renderSection(find('routes', 'pages'), '1. Page-by-page UI walkthrough'));
D.push(`\n### 1.cov Full page coverage (all ${pages.length} routes)

Every route must get at least the **S1 Global checklist**. Routes marked "Deep" also have scripted cases above.

${covTable(pages, deepPages, 'section 1')}

---
`);

// 2. Journeys
D.push(renderSection(find('journey'), '2. End-to-end user journeys'));
D.push(`\n### 2.extra Additional journeys to script + run

The completeness critic flagged these higher-order journeys; walk each end to end and confirm no data loss, no stuck state, and a notification/receipt at each hand-off:

${(critic.missingJourneys || []).map((j) => `- [ ] ${prose(j)}`).join('\n')}

---
`);

// 3. On-chain + services
D.push(renderSection(find('onchain', 'services'), '3. On-chain + services tests'));
D.push('\n---\n');

// 4. API
D.push(renderSection(find('api'), '4. API endpoint tests'));
D.push(`\n### 4.cov Full API coverage (all ${apis.length} routes)

Every endpoint must be checked for: happy path, empty/pending, error/outage, auth (401/403 where applicable), input validation, and honesty of source.

${covTable(apis, deepApis, 'section 4')}

---
`);

// 5. Components + state matrix
D.push(renderSection(find('component'), '5. Components + universal state matrix'));
D.push('\n---\n');

// 6. Copy / writing
D.push(renderSection(find('copy', 'writing'), '6. Copy + writing QA'));
D.push('\n---\n');

// 7. Design / brand / a11y (AUTHORED - the enumerator agent for this dimension did not return)
D.push(`## 7. Design, brand fidelity + accessibility

> Authored directly (the design enumerator did not return structured output). Compare every surface against the prototype contract in CLAUDE.md, ${cc('.claude/rules/ui.md')}, and the tokens in ${cc('desing/')}. The intended difference from the prototype is *real data*, never a visual reinterpretation.

#### 7.1 Typography
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Inspect display headings + the Atrium wordmark | ${cc('Instrument Serif')}, italic where the prototype is italic; warm ink color, not pure black | HIGH | [ ] |
| 2 | Inspect body + numbers | Body ${cc('Geist')}; tabular/mono figures use ${cc('Geist Mono')}; numbers align in tables | MED | [ ] |
| 3 | Check the wordmark underline motif | Present where the brand kit specifies; not a generic logo | LOW | [ ] |

#### 7.2 Color, radii, shadows, motion
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Eyeball the canvas + ink | Warm parchment (${cc('#FBFAF7')} family), ink near ${cc('#1A1714')} - no stark white app feel | HIGH | [ ] |
| 2 | Check status colors | Green ${cc('oklch(0.58 0.13 145)')}, amber, terracotta ${cc('rgb(126,42,32)')}; used consistently for live/warn/neg | MED | [ ] |
| 3 | Check corner radii + card shadows | Radii from the 6/10/12/14/16/pill set; shadows subtle + layered, never glossy | MED | [ ] |
| 4 | Hover cards + trigger transitions | Fast 120-200ms color/transform; card lift on the prototype's cubic-bezier; restrained, no neon | MED | [ ] |
| 5 | Watch the favicon tab | Black tile, italic A, breathing status bar (amber/green/red testnet health) | LOW | [ ] |
| 6 | Compare landing section order | hero -> product -> Plinth -> Aqueduct -> Sigil dark -> Lantern -> live stats -> subsystems -> architecture -> cohort -> closing | MED | [ ] |
| 7 | Scan for generic shadcn defaults | No unstyled default buttons/cards/inputs that break the prime-brokerage feel | HIGH | [ ] |

#### 7.3 Responsive (run on 375 / 768 / 1280)
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Load every /app/* page at 375px | Mobile shell renders real data (not a decorative mock); stats stack; tables become cards | BLOCKER | [ ] |
| 2 | Open every modal at 375px | Fits viewport, scrolls if needed, close control reachable, no clipped buttons | HIGH | [ ] |
| 3 | Landing at 768px | Sections reflow, no overlap (watch the Kani/Plinth diagram + nav) | HIGH | [ ] |
| 4 | Rotate / very wide (1440px+) | Content max-width holds; no stretched line lengths or stranded controls | LOW | [ ] |

#### 7.4 Accessibility
| # | Do this | Expect | Sev | Pass |
|---|---------|--------|-----|------|
| 1 | Run axe-core / Lighthouse a11y on the main pages | No critical violations; score >= 90 | HIGH | [ ] |
| 2 | Keyboard-only through a full journey (deposit) | Every step doable without a mouse; focus never trapped or lost | HIGH | [ ] |
| 3 | Check color contrast on text + status chips | Meets WCAG AA (4.5:1 body, 3:1 large) | HIGH | [ ] |
| 4 | Check icons/images | Meaningful ${cc('alt')}/aria labels; decorative ones hidden from SR | MED | [ ] |
| 5 | Enable OS "reduce motion" | Animations tone down; no essential info conveyed by motion alone | MED | [ ] |
| 6 | Screen-reader a live-updating tile | Updates are announced (aria-live) or at least not disruptive | MED | [ ] |

*Hunt for:* off-brand neon/crypto-dashboard styling, pure-white panels, generic component defaults, layout overlap on mobile, invisible focus rings, low-contrast amber-on-parchment, charts that overflow on small screens.

---
`);

// 8. Security + performance
D.push(renderSection(find('security', 'performance'), '8. Security, performance + robustness'));
D.push('\n---\n');

// 9. GO / NO-GO gate
D.push(`## 9. Launch-ready GO / NO-GO gate

**The rule:** every gate below must be GREEN, and there must be **zero open BLOCKER findings** anywhere in this document, to call Atrium launch-ready. A single fabricated-number or dead-critical-flow finding is an automatic NO-GO.

| # | Gate (all must be GREEN) | Status |
|---|--------------------------|--------|
${(critic.launchGateRecommendations || []).map((g, i) => `| ${i + 1} | ${cell(g)} | [ ] |`).join('\n')}

### 9.1 Hard NO-GO triggers (any one blocks launch)
- A screen shows a **fabricated number as real** (TVL, balance, APY, counts, fees).
- A **critical flow dead-ends**: connect, faucet, deposit, withdraw, open/close position (after the timelock), transfer, mandate, kill switch, verify-balance.
- A **silent failure**: an action appears to succeed but no tx/state change happened, or an error is swallowed with no user feedback.
- A **security finding**: auth bypass, IDOR (one wallet reads another's data), CSRF on a mutation, a signature that does not bind to its mandate, or a leaked secret.
- A **mobile-broken** core surface (any /app/* page unusable at 375px).

---

## 10. Sign-off

Launch-ready is a decision, not a vibe. Fill this in only when the gate above is fully green.

| Dimension | Reviewer | Result (PASS / FAIL) | Open blockers | Date |
|-----------|----------|----------------------|---------------|------|
| 1. Pages (all ${pages.length}) |  |  |  |  |
| 2. User journeys |  |  |  |  |
| 3. On-chain + services |  |  |  |  |
| 4. API (all ${apis.length}) |  |  |  |  |
| 5. Components + states |  |  |  |  |
| 6. Copy + writing |  |  |  |  |
| 7. Design + brand + a11y |  |  |  |  |
| 8. Security + performance |  |  |  |  |
| **Overall launch-ready?** |  |  |  |  |

> Note (current state, 2026-05-29): trading/open-position is scheduled and unlocks ~2026-05-31 02:20 UTC; until then mark those journey items "gated (expected)" rather than FAIL. The subgraph is syncing, so live numbers ramp from ${cc('pending')} to real - re-run the data-honesty checks after it catches up.

---

*This plan was generated from the codebase, not from memory. Re-run ${cc('node scripts/build-qa-doc.mjs <workflow-output.json>')} after major changes to refresh the page/API coverage and scripted cases.*
`);

let doc = D.join('\n');
// final safety: strip any stray em/en dashes the data carried in
doc = doc.replace(/[—–]/g, '-');
fs.writeFileSync(DOC_PATH, doc);
const lines = doc.split('\n').length;
console.log(`Wrote ${DOC_PATH}: ${lines} lines, ${(doc.length / 1024).toFixed(0)} KB`);
console.log(`Pages: ${pages.length} (deep: ${deepPages.size}) | APIs: ${apis.length} (deep: ${deepApis.size})`);
console.log(`Sections: ${sections.map((s) => s.dimension).join(', ')}`);
