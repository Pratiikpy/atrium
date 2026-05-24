# Atrium frontend audit — 2026-05-24

Auditor: Claude (auditor B). Scope: every React route under `apps/verify/`, the two static
mobile HTML files, design fidelity vs `desing/`, mobile experience, and copy. NOT contracts,
NOT off-chain services. Builds on `AUDIT_USER_FLOWS.md` rather than re-doing flow grading.

## Headline

The React app (`apps/verify/src/app/**`) is honest and shipped to a high standard. Banned-words
sweep is clean, every component I read has real states (loading / empty / error / permission /
success) and real wallet handlers wired through wagmi. The cohort grid, settings tabs, top-up
banner, verifier step runner, and onboarding flow all honour the no-fake-data rule with named
blockers.

**The honesty problem lives in three files, not the React app:**

1. `apps/verify/public/landing-v2.html` — the desktop landing. The bundled React inside this
   self-contained HTML hardcodes a `PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG",
   "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]` array; the "live TVL" ticker is
   literally `useState(4.13)` with a `Math.random()` drift; portfolio numbers ($12,378,422,
   $4.13M, 3.12×, 38.4%, 14 positions) are string literals; per-venue collateral
   ($1,247,820 HL-HIP3, $892,440 Aave, $320,500 Pendle) is hardcoded. This is the file mobile
   UAs do **not** see (middleware rewrites them away), but every desktop visitor lands on it.
   This violates `.claude/rules/writing.md` and `LAUNCH_READY.md §3.2/§3.5` head-on.
2. `apps/verify/public/mobile-app.html` — vanilla JS, no wagmi. Hero $12,374,820, 4 fake
   positions, 5 fake agents on Rostrum, fake delphi.eth mandate, fake Aqueduct $50,000 USDC
   transfer, fake activity log. The post-load hydration script only replaces the hero
   buying-power and zeroes-out the positions list when the API returns empty; every other
   number stays fake. Every primary button (`Open long`, `Move $50,000 USDC`, `Manage`,
   `Apply`, `All ↗`, `New ↗`) is dead — pointing at `href="#"` or with no handler.
3. `apps/verify/public/mobile-landing.html` — better than the desktop landing (cohort strip
   was honest-empty per the recent fix), and the JS hydration overwrites the stats band from
   `/api/protocol/metrics`. But the impluvium per-venue values, the mock Plinth card
   ($12,374,820 / $4.13M / 3.0× / 38.4%), the Aqueduct $50,000 mock, and the Sigil mock
   stay hardcoded. Footer links all dead (`href="#"` × 10).

The React `/app/page.tsx` aside also lies — every subsystem reads "Source built · deploy
Month 1 W2" even though Coffer, Sigil, Vigil, Plinth are deployed today (per `LAUNCH_READY`
header). That contradicts the same project's own deployment registry.

Beyond those, eleven medium findings around stale copy, fake "live source" badges on the
Markets page, dead nav coverage of `/app/markets` and `/app/notifications`, hardcoded wallet
placeholder in the AppShell sidebar, and footer link rot in the static mobile files.

The verifier walk, the onboarding flow, and every wagmi-wired component on `/app/*` are
genuinely good — the audit kudos section is real, not a politeness sandwich.

## Per-page status

| Route | Renders? | Real data wired? | Mobile parity | States missing | Top finding |
| --- | --- | --- | --- | --- | --- |
| `/` (desktop, landing-v2.html) | yes | no — `PARTNERS[]`, TVL `useState(4.13)`, $12,378,422 all hardcoded | served by mobile-landing.html | loading/error invisible (random ticker fakes liveness) | **CRITICAL: 8 fake partner names + random-number live ticker** |
| `/` (mobile, mobile-landing.html) | yes | partial — stats band overwritten from `/api/protocol/metrics`; impluvium/Plinth/Aqueduct mocks fake | n/a | error state: when fetch fails sets `$0` / `0` (good) | Plinth/Aqueduct/Sigil mock cards still show $12.37M placeholders |
| `/app` | yes | no — Plinth/Coffer/Sigil/Vigil status shows "Source built · deploy Month 1 W2" (deployed today per LAUNCH_READY) | sidebar nav doesn't list `/app/markets` or `/app/notifications` | none missing structurally | Stale roadmap copy contradicts deployed contracts |
| `/app/onboarding` | yes | yes — real WebAuthn + `/api/faucet/status` + `/api/portfolio/buying-power` | passes through middleware → mobile shell | full set present | Skip button advances when faucet pending — correct behaviour |
| `/app/portfolio` | yes | yes — every card reads from `/api/portfolio/*` and degrades to `—` honestly | mobile shell shows fake positions | loading skeleton + honest `—` per card | Header copy "Plinth · margin engine" honest |
| `/app/portfolio/activity` | yes | yes — full timeline component | mobile shell | states present | wired off "View all" link, good |
| `/app/trade` | yes | yes — wagmi `useOpenPosition`, real adapter resolution | mobile shell shows fake long/short | risk preview modal, honest pending | "from Plinth.update_margin · simulated" caption is correct |
| `/app/transfer` | yes | yes — `TransferForm` + `TransferTimeline` + `RecentTransfers` all live | mobile shell shows fake $50K transfer | "View all" link removed honestly | Clean |
| `/app/vault` | yes | yes — wagmi deposit/withdraw + virtual-shares offset explained | mobile shell | full set; "circuit breaker" listed | Safety SLA bullets clear |
| `/app/agents` | yes | yes — `NewMandateButton` opens real IntentSigil EIP-712 modal | mobile shell shows fake delphi.eth mandate | gated by `useDeploymentStatus` | Active count "0" in sidebar badge — wired honestly |
| `/app/markets` | yes | **NO — every venue carries hardcoded "live source" pill regardless of subgraph state** | mobile shell | no per-venue health check | Markets page falsely advertises 6 venues as "live source" |
| `/app/notifications` | yes | yes — reads `/api/notifications` | mobile shell | wired | Sidebar nav doesn't list this; only the bell icon reaches it |
| `/app/reserves` | yes | yes — `VerifyMyBalanceButton` reads Lantern + computes inclusion proof in-browser | mobile shell | gated honestly when attestor hasn't published | Strong |
| `/app/settings` | yes | yes (Wallet tab); other 5 tabs render honest "coming Month X" banner | mobile shell | 5/6 tabs explicitly pending with named month | Strong |
| `/app/tax` | yes | yes — `TaxView` + signed-Merkle disclaimer | mobile shell | tax service unavailable → honest pending | Disclaimer matches `ATRIUM_FULL_FLOW_DESIGN.md` |
| `/agents/marketplace` | yes | partial — three reference agents are real repos in `agents/`; community list honestly empty | desktop only (no middleware rewrite) | RecessedCard for empty state | "Submit on GitHub" CTA points at a personal-fork URL — should be a canonical org URL |
| `/verify/1`..`/verify/7` | yes | yes — `VerifierStepRunner` checks `/api/deployments/status?step=N`, button disabled with "Step not wired yet" warning per step | desktop only (no rewrite for `/verify`) | full set incl. permission ("Switch to Arbitrum Sepolia") | Best-built surface in the whole app |
| `/lantern` | yes | yes — `LanternDashboard` reads attestor with honest "no attestation yet" | desktop only (no rewrite) | full set | Strong |
| `/lantern/sla` | yes | static content (5 circuit-breakers); no API needed | desktop only | n/a | Strong |
| `/cohort` | yes | yes — `CohortGrid` queries Scribe, honest empty list | desktop only | full set | Strong |
| `/cohort/[id]` | yes | yes — all stats show `—` until Scribe has data | desktop only | full set | Strong |
| `/brand` | yes | static brand kit | desktop only | n/a | Sample cards say "value slot" — fixed in U-22, good |
| `/changelog` | yes | static; `WAVES[]` hardcoded but doc explains it's a manual mirror of `docs/AUDIT_FINDINGS.md` | desktop only | n/a | Acceptable |
| `/chaos` | yes | yes — `/api/chaos/inject` with real error branches | desktop only | full set | Strong |
| `/docs` | yes | static external links to GitHub | desktop only | n/a | "$5K ARB per accepted adapter" copy needs source link |
| `/learn` | yes | static; `id="adapters"/"span"/"sigil"` anchors wired | desktop only | n/a | Strong |
| `/legacy` | exists | unknown scope | desktop only | unknown | Should be removed or renamed if it's dead code |
| `/legal/privacy` | yes | static | desktop only | n/a | Strong, "Last updated: 2026-05-18" stable |
| `/legal/terms` | yes | static | desktop only | n/a | Strong |
| `/loadtest` | yes | `LoadtestDashboard` should read real measurements | desktop only | unknown — depends on component | SLOs listed; need to verify the dashboard is real-time |
| `/manifesto` | yes | static; honest voice | desktop only | n/a | Strong copy |
| `/rostrum` | yes | `RostrumLeaderboard` should read Plinth events via Scribe | desktop only | unknown | Need to verify the live leaderboard isn't fake |
| `/security` | yes | static; "Cross-cutting audit was run on 2026-05-18 by six parallel sub-agents" claim is doc-sourced | desktop only | n/a | Strong |
| `/sla` | yes (redirect → `/lantern/sla`) | n/a | desktop only | n/a | Strong |
| `/team` | yes | static; F1/F2/F3 codename treatment per `human_left.md` | desktop only | n/a | Strong |
| `/benchmarks` | yes | static table; Cascade + August comparables honestly say where Atrium loses | desktop only | n/a | Strong |
| `/api/*` | n/a | per-route | n/a | n/a | Out of scope |

## Critical findings (block launch)

### C-1 — Desktop landing-v2.html ships 8 fake partner names and a random-number live ticker
**File:** `apps/verify/public/landing-v2.html` (bundled inside `__bundler/manifest` script,
decoded blob `b949c935-93e9-4660-b33c-54044acc081d`, JSX module).

The desktop landing is a self-contained Vite-style bundle that injects a React app into the
`#__bundler_loading` div. Inside that bundle:

```js
const PARTNERS = [
  "Pendle Labs", "Variational", "Horizen", "IOSG",
  "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"
];
```

None of these have signed. Cohort outreach is documented as a human task in `human_left.md`
and the mobile landing was fixed on 2026-05-24 to show an honest "Open to applications" empty
state. The desktop landing was missed.

Same file embeds a "live TVL" component:

```js
const [tvl, setTvl] = useState(4.13);
const [agents, setAgents] = useState(37);
const [queries, setQueries] = useState(42109);
useEffect(() => {
  const t = setInterval(() => {
    setTvl(v => v + (Math.random() - 0.4) * 0.005);
    setQueries(v => v + Math.floor(Math.random() * ...));
  }, ...);
});
// → <NumberBig n={"$" + tvl.toFixed(2) + "M"} l="Live testnet TVL" sub="+ 41.2% vs 30d ago" />
```

The "live testnet TVL" the desktop landing shows is literally a random-walk simulation
seeded at $4.13M. The subtitle "+ 41.2% vs 30d ago" is a hardcoded string. The dashboard
mock shows `$12,378,422` and `+ $284,920` deltas, with `$4.13M` collateral,
`3.12×` ratio, `38.4%` utilisation, `14` open positions — all string literals.

This violates `.claude/rules/writing.md` ("Every number on screen has a real source… No
hardcoded constants pretending to be live data") and `LAUNCH_READY.md §3.2` ("All data is
real — no mocks, no placeholders, no fakes"). It is the same class of failure as the
mobile-landing trust strip that was fixed today.

Fix: either (a) replace this bundle with a real Next.js landing page that reads from
`/api/protocol/metrics` + Scribe partner query, or (b) rewrite the bundle's `PARTNERS` array
to be empty + replace the `useState(4.13)` ticker with a `fetch('/api/protocol/metrics')`
that falls back to `pending` on error (same pattern as `mobile-landing.html`'s post-load
hydration script).

### C-2 — Mobile app shell is a clickable mockup
**File:** `apps/verify/public/mobile-app.html` (1485 lines, 59 KB, vanilla JS).

Every mobile UA that visits `/app`, `/app/portfolio`, `/app/trade`, `/app/transfer`,
`/app/agents`, `/app/reserves`, `/app/tax`, `/app/settings`, `/app/markets`,
`/app/notifications`, `/app/onboarding`, `/app/vault`, `/app/portfolio/activity` is rewritten
by `src/middleware.ts` to `mobile-app.html`. That file:

- Has zero wagmi / viem imports. Cannot connect a wallet, cannot send a transaction.
- Hardcodes the entire screen: `$12,374,820` buying power, 4 fake positions
  (rTSLA-PERP $1.82M, USTB $892K, PT-stETH $320K, WBTC/USDC $401K), 5 fake agents on
  Rostrum (delphi.eth, pareto.eth, helios.eth, kepler.eth, aurora.eth), 1 fake mandate
  (delphi.eth $12,418 / $50,000 · 5d left), 3 fake activity rows, fake $50,000 Aqueduct
  transfer, fake wallet `0x1a3b…7f29 / atrium.eth`.
- Buttons that decoratively respond but do nothing real:
  - **Line 1130:** `<button class="primary-btn long" id="submit-btn">Open long · rTSLA-PERP</button>`
    — sends no transaction; the handler at line 1396 only toggles colour and label text.
  - **Line 1180:** `<button class="primary-btn">Move $50,000 USDC</button>` — no handler at all.
  - **Line 1196:** `<button class="cta">Manage</button>` — no handler.
  - **Lines 981, 1033, 1188, 1201:** `<a href="#" class="more">All ↗ / New ↗</a>` — all dead.
  - **Lines 1278-1318:** every "More" row (Proof of reserves, Tax · UK CGT, Session keys,
    Account, Recovery, etc.) is a non-anchor `<div class="more-row">` with no handler. The chevron is decorative.
  - **Action grid lines 952-975:** three of the four big home-screen action tiles (Trade,
    Move, Agents) switch the in-page tab; the fourth (Reserves) has no `data-go` attribute
    and no handler at all.
- The end-of-file hydration script (lines 1431-1482) does fetch
  `/api/portfolio/buying-power` and `/api/portfolio/positions`, but:
  - Only replaces the hero `$12.37M` and the positions section header.
  - On any other fetch error, **leaves the design placeholders in place** with
    `console.warn('[atrium-mobile] positions API unavailable')`. The reason given inline:
    "Leave the design placeholders if the API errors — better than an empty screen for the
    buildathon demo." That contradicts `.claude/rules/ui.md` "Never display a placeholder
    number that looks real."
  - Hero card "24h delta" `+ $284,920 · 2.36%` is hidden only when the API returns null —
    if the API returns a real `currentUsd` but no history, the fake delta stays visible.
  - The fake positions remain visible if the positions endpoint *returns positions*; the
    code only hides them on the empty case. If the wallet hooked to the API has zero real
    positions but the API doesn't return `[]` (e.g. errors), the fake $1.82M, $892K, $320K,
    $401K rows ship.
  - Trade panel, Move panel, Agents panel, More panel are **never hydrated** — those four
    tabs always show 100% design placeholders.

This is the largest single failure surface for any mobile demo. Fix options in priority
order:

- **(A) Port the React `/app/*` pages to be responsive** and delete the middleware mobile
  rewrite. Cost: ~3-5 days. The React pages already include a mobile nav strip
  (`apps/verify/src/components/app-shell.tsx:175-200`) so the chrome is partly done; the
  big change is reflowing each page's grid and replacing the desktop sidebar with the
  mobile bottom tabbar from the design. Net win: one app, one set of states, one wagmi
  bundle.
- **(B) Embed wagmi + viem + WalletConnect into the vanilla mobile shell.** Cost: ~1 day
  smaller surface but you now maintain two wallet integration paths and the mobile-app.html
  bundle grows to 200+ KB. Not recommended — duplicates state machines.
- **(C) Short-term band-aid:** flip the hydration script to **always** clear placeholders
  on missing data (not "leave the design placeholders if the API errors"). Wires every
  visible number to the API and shows honest-pending text on failure. Decorate every dead
  button with `disabled` + a tooltip naming the blocker. Cost: ~2 hours. Still doesn't fix
  the "cannot transact on mobile" problem — that requires (A) or (B).

### C-3 — Mobile-landing.html mock cards advertise fake $12.37M and $50,000 transfer
**File:** `apps/verify/public/mobile-landing.html` lines 880-1023.

The page header stats band hydrates from `/api/protocol/metrics` (good, fixed in the
2026-05-24 wave). But the per-product **feature cards** keep fake numbers:

- **Impluvium per-venue collateral (lines 893-933):** HL-HIP3 $1.25M, Aave $892K, Trade
  $401K, Pendle $320K, HL-HIP4 $483K, Curve $186K — all hardcoded `<div class="amt">`
  values, no API call.
- **Plinth mock card (lines 958-988):** big number `$12,374,820`, `$4.13M` collateral,
  `3.0×` ratio, `38.4%` utilisation — hardcoded, no API call. Plus the "live" pill at
  line 961 labels these as live when they are static design samples.
- **Aqueduct mock (lines 1008-1023):** `50,000 USDC` transfer, `≈ 8.4s · $0 fee` —
  hardcoded.
- **Stats sub-deltas (lines 1073, 1078, 1083, 1088):** `+ 41.2% · 30d`, `8 with open
  positions`, `x402 · onchain`, `RH-Chain · pending` — not in the hydration script, so
  they ship as static design copy.

These are not as bad as C-1 (the desktop landing) because they're product-illustration
cards not "live stats", but the "live" pill on line 961 over the fake $12,374,820 is
the same class of failure as desktop. Fix: replace the pill with "design preview", or
wire the same `/api/protocol/metrics` hydration to overwrite the impluvium bars and
Plinth card.

### C-4 — Mobile landing footer is 10 dead links
**File:** `apps/verify/public/mobile-landing.html` lines 1148-1160.

```html
<a href="#">Portfolio</a><a href="#">Trade</a><a href="#">Cross-chain</a>
<a href="#">Agents</a><a href="#">Reserves</a>
<a href="#">Documentation</a><a href="#">Brand kit</a><a href="#">GitHub</a>
<a href="#">Status</a><a href="#">Contact</a>
```

Every footer link is `href="#"`. These correspond to real routes (`/app/portfolio`,
`/app/trade`, `/app/transfer`, `/app/agents`, `/app/reserves`, `/docs`, `/brand`, …) so
the fix is mechanical: wire each anchor to its real destination. Same problem exists in
the bundled desktop landing-v2 footer (not directly auditable because of the bundler
encoding, but the source likely matches).

### C-5 — `/app/page.tsx` Live-status panel lies about deploy state
**File:** `apps/verify/src/app/app/page.tsx` lines 52-57.

```tsx
<Row label="Plinth" status="Source built · deploy Month 1 W2" />
<Row label="Coffer (vault)" status="Source built · deploy Month 1 W2" />
<Row label="Sigil (agents)" status="Source built · deploy Month 1 W2" />
<Row label="Vigil (liquidator)" status="Source built · deploy Month 1 W2" />
<Row label="Adapters (6)" status="All shipped" />
<Row label="Lantern attestor" status="Cron deferred to Month 6" />
```

But `LAUNCH_READY.md` line 4 says: "30 contracts deployed on Arbitrum Sepolia, all verified
on Sourcify. Plinth shipped via cargo-stylus 0.10.7 multi-fragment factory." Coffer is at
`0x7420…2071`, Sigil at `0xefd3…70d0`, Vigil at `0x6771…522e`, Plinth at `0x4852…4781`,
and there are **9** adapters, not 6.

The aside captions itself "Live state from `/api/deployments/status`" but the values are
hardcoded JSX strings, not fetched. This contradicts the project's own honesty rule and
the literal claim in the same caption. Fix: replace the static `<Row>` calls with a
`useQuery` against `/api/deployments/status` and render the real deploy/activation state
per subsystem.

## High-priority findings (block "no compromise" claim)

### H-1 — `/app/markets` advertises "live source" on every venue without checking
**File:** `apps/verify/src/app/app/markets/page.tsx` line 66.

Every of the 6 venue cards renders `<span>live source</span>` as a static pill, no API
check. Per the deployment registry only some adapters are whitelisted in PorticoRegistry
and even fewer have a working venue contract on Sepolia. Either remove the pill or wire
it to `/api/deployments/status?subsystem=adapter-<slug>`. Also the page only lists 6 of
the 9 deployed adapters (Synthetix V3, Morpho Blue, GMX V2 are missing from `VENUES[]`).

### H-2 — AppShell sidebar hardcodes a placeholder wallet
**File:** `apps/verify/src/components/app-shell.tsx` lines 141-148.

```tsx
<div className="mx-3 mb-4 mt-2 flex items-center gap-2 ...">
  <span className="size-7 shrink-0 rounded-full bg-gradient-to-br ..." />
  <div className="min-w-0 flex-1">
    <p className="truncate font-mono text-xs text-ink">0x1a3b…7f29</p>
    <p className="text-[10px] text-muted">arb-sepolia · rh-chain</p>
  </div>
  <span className="text-muted">›</span>
</div>
```

That address is the same placeholder from the prototype HTML. A real user connected to
the app sees a sidebar that doesn't show their real address. Fix: wagmi `useAccount()`
on the client, fall back to "not connected" with a Connect prompt.

### H-3 — AppShell sidebar nav is missing `/app/markets` and `/app/notifications`
**File:** `apps/verify/src/components/app-shell.tsx` lines 37-61.

`NAV_GROUPS` lists 7 items across 4 sections but the app has 11 pages. Markets and
Notifications render the same AppShell with `active="/app/markets"` and `active="/app/portfolio"`
respectively, but neither is reachable from the sidebar. Notifications is reachable from
the topbar Bell icon; Markets is reachable only by URL or from the AppHome's tile grid.

Add a "Markets" entry under the Trade group and a "Notifications" entry under Account, or
move Notifications to the Bell action only and document Markets in the home tile grid.

### H-4 — Mobile-app More-row icons / nav rows have no destination
**File:** `apps/verify/public/mobile-app.html` lines 1276-1318.

The "More" tab has rows like "Proof of reserves · 38m", "Tax · UK CGT · 2026", "Session
keys · 3", and on subsequent sections "Recovery", "Notifications", "Account" — all
rendered as `<div class="more-row">` with a chevron, but no `<a href=…>` wrapping. On
mobile, every one is a tap target that does nothing. These should be `<a>` links to the
real React routes or, if the mobile-app shell stays vanilla, the rows should be removed
until those mobile flows exist.

### H-5 — `mobile-app.html` hydration "leaves the design placeholders if the API errors"
**File:** `apps/verify/public/mobile-app.html` lines 1477-1481.

```js
} catch {
  // Leave the design placeholders if the API errors — better than
  // an empty screen for the buildathon demo. Still flag in console.
  console.warn('[atrium-mobile] positions API unavailable');
}
```

This is a deliberate decision to ship fake data on error, with a code comment naming the
trade-off. Per `.claude/rules/ui.md`: "If a number is unavailable, show the reason and a
refresh action. Never display a placeholder number that looks real." Replace with
honest-pending text.

### H-6 — Stale "Source built · deploy Month 1 W2" status in onboarding step 4
**File:** `apps/verify/src/components/onboarding/onboarding-flow.tsx` line 409.

```tsx
{isLive ? '● Plinth · margin ok' : '● Plinth · source built · deploy Month 1 W2'}
```

Plinth IS deployed. The "source built · deploy Month 1 W2" message will fire whenever
the buying-power API returns `source !== 'plinth'`, which is the truth today only because
the API hasn't been wired to the new Plinth address — not because Plinth source-is-built-
but-not-deployed. The wording is no longer accurate. Replace the not-live branch with a
generic "● Plinth · margin pending Scribe index" or read the actual deploy state from
`/api/deployments/status`.

### H-7 — Mobile-landing "Documentation" CTA dead
**File:** `apps/verify/public/mobile-landing.html` line 1136.

```html
<a href="#" class="ghost">Documentation</a>
```

Sits next to the primary "Open testnet ↗" button. Should point at `/docs` — the route
exists and renders today.

### H-8 — landing-v2 bundle is 1.6 MB
**File:** `apps/verify/public/landing-v2.html` (1,624,364 bytes).

`.claude/rules/ui.md §3.4` carves out the "self-contained marketing HTML" from the
250 KB budget, so the byte count itself is permitted. But:

- The bundle contains the entire React runtime (`74a6644f-…` = 3.1 MB of node_modules incl.
  browserslist tables, babel, postcss, autoprefixer, react-dom prod) — none of which a
  landing page needs at runtime. Looks like a Vite dev-mode bundle was committed.
- Time-to-interactive on the landing was not measured. The TTI budget is ≤ 1.5s on
  broadband (`ui.md §3.4`). A 1.6 MB single-file bundle (no CDN font caching, no code
  splitting) will not hit 1.5s TTI on a cold load.
- Lighthouse audit per `LAUNCH_READY.md §3.4` requires ≥ 90 mobile across perf / a11y /
  best-practices / SEO. Never run; needs to be measured before the launch-ready claim.

Fix path: rebuild the desktop landing as a real Next.js route at `apps/verify/src/app/page.tsx`
(currently there is no `page.tsx` at the root — the React app's root is the redirect-to-
self that pulls `landing-v2.html` from the static folder; verify the routing). The static
HTML approach worked when the landing was a stand-in for the design prototype, but as a
shipped page it loses Next.js's optimizations.

## Medium-priority polish

### M-1 — Markets page lists 6 venues, deploy registry has 9
**File:** `apps/verify/src/app/app/markets/page.tsx`. Missing: Synthetix V3, Morpho Blue,
GMX V2 (all deployed per `LAUNCH_READY` Phase C). Add cards for the missing three.

### M-2 — `/agents/marketplace` "Submit on GitHub" CTA points at a personal fork
**File:** `apps/verify/src/app/agents/marketplace/page.tsx` line 85.
`https://github.com/Pratiikpy/atrium` is the personal fork. If the canonical org repo is
different, use that.

### M-3 — `/docs` cards reference docs that don't exist at the linked path
**File:** `apps/verify/src/app/docs/page.tsx` lines 36-38.
`docs/LAUNCH_READINESS.md` is referenced but the file at repo root is `LAUNCH_READY.md`
(different name). Verify and fix the GitHub URL.

### M-4 — `/changelog` is a hardcoded mirror of `docs/AUDIT_FINDINGS.md`
**File:** `apps/verify/src/app/changelog/page.tsx` lines 26-97.
The WAVES[] array is manually authored. The doc-stated single-source-of-truth is
`docs/AUDIT_FINDINGS.md`. Either generate the page at build time from the markdown, or
add a CI check that catches divergence. Today the page is unmistakably stale —
"Wave N · 2026-05-18 · 14 patches" doesn't include the 2026-05-24 mobile work, the
deployment work, or anything between.

### M-5 — Sidebar "Agents · 3" badge in `desing/` mock is wired to "0" in code
**File:** `apps/verify/src/components/app-shell.tsx` line 48: `badge: '0'`. Hardcoded,
should read from a real "active mandate count" query. Same goes for the `'✓'` Reserves
badge on line 53 — claims attestation success without reading state.

### M-6 — `/app/portfolio` 24-hour P&L hides honestly but the layout reserves the space
The PRD says "today the 24-hour P&L shows '—' because we haven't wired the price-history
feed yet, and we say that honestly rather than fake a zero". The `PortfolioStatRow`
component renders that; check that all four stats render `—` rather than `$0.00` when
their source is pending.

### M-7 — `/legacy` page exists with unclear scope
**File:** `apps/verify/src/app/legacy/page.tsx`. Either rename to clarify what it is or
remove it. A "legacy" route on a v1 product is a red flag for judges who click around.

### M-8 — Static "8/16 design partners" claim in PARTNERS array (desktop landing)
Same root as C-1. Even after fixing the visible logo strip, the JS module's `PARTNERS`
array remains in source — strip it entirely so a regex sweep doesn't surface the names.

### M-9 — Settings · Account / Recovery / etc. always show the same "coming Month X" banner
**File:** `apps/verify/src/components/settings/subnav.tsx` lines 66-78. The banner is
honest and helpful but identical across 5 tabs. A user clicks all 5 and gets the same
text. Either differentiate the body copy per tab (what specifically is missing in
Recovery vs. Network), or collapse them into a single "Coming roadmap" tab.

### M-10 — `landing-v2.html` bundle still contains the full WAVES[] / PARTNERS / VENUES JS
Even after C-1 is fixed, the bundle ships these arrays in source. Source-bundle hygiene
matters because (a) anyone who downloads the page sees the false partner names, (b) any
honest-pending state implemented in JSX is still inconsistent with the literal data in
the constant. Replace the constants with API fetches in the same bundle.

### M-11 — `/app/markets` "Add a venue" footer references a $5K ARB curator grant
**File:** `apps/verify/src/app/app/markets/page.tsx` line 78. Per `LAUNCH_READY.md` the
curator grant requires the Praetor multisig to be live (Phase D-7) — today the multisig
is the deployer EOA. The grant offer is honest in intent but not actionable today. Add a
caption "Grant payouts begin once Praetor multisig is live (Phase D)".

## Banned-words sweep

Ran the writing.md banned-words list across `apps/verify/src/**/*.{ts,tsx}` and
`apps/verify/public/**/*.html` (incl. `landing-v2.html`, `mobile-landing.html`,
`mobile-app.html`):

- **delve, unleash, robust, empower, seamless, streamline, cutting-edge, state-of-the-art,
  revolutionize:** zero hits in user-facing copy. The only matches are in
  `apps/verify/src/lib/writing-banned-words.test.ts` (the linter list itself) and
  `apps/verify/src/lib/use-deployment-status.test.ts:66` (regression test asserting these
  words don't appear).
- **leverage:** legitimate domain term (margin trading), used correctly across
  `risk-preview-modal.tsx`, `order-form.tsx`, and the leverage slider. The test file
  explicitly exempts "leverage" and "harness" as domain vocabulary.
- **harness:** zero hits outside the test.
- **unlock:** zero user-facing hits.
- **In today's, in the realm of, game changing, next generation, powerful + scalable +
  secure, we are excited to announce, we are proud to share, built with love, em-dash drama,
  marketing sandwich:** zero hits.

**Banned-words sweep is clean.** This is genuinely well-policed.

One nuance: the linter test (`writing-banned-words.test.ts`) covers static `.tsx` source,
but per `LAUNCH_READY.md §3.5` it should be widened to include `apps/verify/public/*.html`
— specifically to catch the hardcoded `PARTNERS = […]` literal in `landing-v2.html` once
that file is renamed/exposed. Today the test wouldn't catch a banned word inside a base64-
encoded bundle.

## Design-fidelity gaps (React app vs `desing/`)

### D-1 — Landing v2 (the desktop landing-v2.html) vs `desing/Atrium.html`
Cannot do a clean visual diff because both are large prototype HTMLs. Spot-checked
sections:
- Palette: matches (parchment `#FBFAF7`, ink, terracotta, dark Sigil section).
- Typography: Instrument Serif italic display + Geist body + Geist Mono — matches.
- Section order (hero, product, Plinth, Aqueduct, Sigil dark, Lantern, live stats,
  subsystems, architecture, cohort, closing CTA) — matches per the manifest's `VENUES`/
  `SUBSYSTEMS`/`PARTNERS` constants.
- Favicon: `/atrium-favicon.js` is wired in root layout (line 50) and the static HTMLs
  both `<script src="favicon.js" defer></script>`. Good.
- One delta: the prototype's "Live testnet · all systems normal" pulse dot is wired to a
  static class in the bundle, not a real subgraph-watch state. Same issue as the random-
  walk TVL.

### D-2 — React `/app/portfolio` vs `desing/Atrium App.standalone.html#portfolio`
Layout matches per the doc-comment header in `portfolio/page.tsx`. Stat row, margin
engine card, buying power card, positions filter, activity rail — all present. Pixel
spacing not verified.

### D-3 — Mobile React strip vs prototype mobile design
The React `app-shell.tsx` includes a `<nav>` for mobile (lines 176-200), but for mobile
UAs the middleware rewrites away before the React app even renders. So this nav strip is
only visible to a tablet user who lands on `/app/*` and gets a UA that doesn't match the
mobile regex. The intended mobile UX is the bottom-tabbar in `mobile-app.html`. The two
designs differ (top horizontal strip vs bottom tabbar) — the React strip is dead UI
unless you load `/app/*` on a tablet.

### D-4 — Settings tabs use `✦ ◉ ◐ ⇌ ♬ ◌` text icons
**File:** `apps/verify/src/components/settings/subnav.tsx` line 25-32. Prototype likely
uses lucide-style line icons. Text glyphs feel ascii-art and don't match the rest of the
brand. Replace with SVG icons.

### D-5 — AppShell mobile nav strip lacks the prototype's bottom-tabbar treatment
The React strip is a horizontal scrollable list of pills. The mobile design (the iPhone
mock in `desing/Mobile App.html`) uses a backdrop-blur, fixed-bottom tabbar with 5
slots and active-state glow. If the React `/app/*` ever serves mobile (after C-2 fix),
this needs to be ported.

## Mobile parity report

### Mobile app shell — list of vanilla-JS dead buttons that won't fire txs

| Location | Element | Today's behaviour | Required to wire |
| --- | --- | --- | --- |
| Home `data-go="trade"` | switches tab | OK (intra-page nav) | none |
| Home `data-go="move"` | switches tab | OK | none |
| Home `data-go="agents"` | switches tab | OK | none |
| Home Reserves action (line 970) | no handler | DEAD | add `data-go` or remove |
| Home "All ↗" position list (line 981) | DEAD `href="#"` | DEAD | link to `/app/portfolio/activity` |
| Home activity "All ↗" (line 1033) | DEAD `href="#"` | DEAD | link to `/app/portfolio/activity` |
| Trade "Open long · rTSLA-PERP" (line 1130) | toggles colour, no tx | **NO TX EVER** | needs wagmi `useWriteContract` |
| Trade leverage slider (line 1114) | UI-only | OK | none |
| Trade timeframe buttons (line 1090-1094) | no handler | DEAD | switch chart data |
| Move "Move $50,000 USDC" (line 1180) | no handler | **NO TX EVER** | needs wagmi |
| Move swap-btn (line 1158) | DOM swap of chain cards | OK as decoration | needs amount/balance refresh in real impl |
| Agents "New ↗" (line 1188) | DEAD `href="#"` | DEAD | open mandate-creation modal |
| Agents "Manage" (line 1196) | no handler | DEAD | wagmi revoke flow |
| Agents "All ↗" (line 1201) | DEAD `href="#"` | DEAD | link to `/agents/marketplace` |
| Agents profile rows (each `.agent-card`) | no handler | DEAD | link to `/app/agents` |
| More rows × 6 (lines 1278-1318) | no handler | DEAD | link to respective `/app/*` routes |
| Tab bar × 5 (Home/Trade/Move/Agents/More) | switches panel | OK | none |

Bottom line: the mobile app shell is a perfectly-styled clickable mockup. Every primary
action (Open long, Move USDC, Manage mandate) is a no-op. Every secondary nav element to
a different "page" is `href="#"`. Per `LAUNCH_READY.md §3.1` ("Every button leads somewhere
real. No `onClick={() => {}}` placeholders.") the entire mobile shell fails the rule.

### Recommended port plan with effort estimate

The right move is **option A from C-2** — port the React `/app/*` pages to be
responsive and delete the mobile middleware rewrite. Reasoning:

- Avoids maintaining two wallet integrations.
- Reuses every wagmi hook + every honest-pending state already built.
- The `mobile-app.html` design language (OLED dark, glass tabbar, hero card) can be
  applied as a `@media (max-width: 720px)` restyle of the existing pages — most of the
  React components already have generic Tailwind classes that could swap palette via CSS
  variables.

Effort by phase:

1. **Palette/dark-mode tokens** — add OLED-dark CSS variables to `globals.css`, gated on
   `prefers-color-scheme: dark` AND a mobile-UA hint. ~4 hours.
2. **Bottom tabbar component** — port the `desing/Mobile App.html` tabbar (5 slots,
   backdrop-blur, active glow) as a React component, only render on small viewports.
   ~3 hours.
3. **Page-by-page reflow** — each of the 11 `/app/*` pages needs a mobile-first version
   of its main grid. Portfolio (4-stat row → vertical stack + hero card), Trade (3-col →
   tabbed), Transfer (form unchanged), Vault (deposit/withdraw → tab), Agents (already
   list-based), Reserves (cards → stack), Tax (table → cards), Settings (sidebar → drawer
   or list), Markets (already list), Notifications (already list), Onboarding (already
   responsive). ~6 hours per page × 11 pages ≈ 66 hours; faster if shared mobile-layout
   primitives are built first.
4. **Delete `middleware.ts` mobile-UA rewrite** + delete `mobile-app.html`. Smoke-test
   every flow on a real iPhone Safari + Android Chrome. ~4 hours.

**Total estimate:** 5-10 focused days. Realistic timeline against current priorities:
post-buildathon polish.

Until then: short-term band-aid per option C in C-2 (clear placeholders on missing data,
disable dead buttons with honest tooltips). ~2 hours, ships honest mobile-app even though
non-functional.

## Per-flow walk (15 flows from `LAUNCH_READY.md §2`)

Walk style: entry route → next step → first break → unblocker. Differs from
`AUDIT_USER_FLOWS.md` (which covered contract/backend wiring) — I'm focused on the UI
path the user actually walks.

### Flow 1 — Land on `/` and understand Atrium in 90s
- **Entry:** `/` (desktop landing-v2.html or mobile-landing.html via middleware).
- **Next step:** read hero, scroll through Plinth/Aqueduct/Sigil sections, hit closing CTA.
- **Breaks at:** desktop landing's "$12.37M live TVL" is a random-number ticker (C-1); a
  judge inspecting will catch it. Mobile landing partially fixed but Plinth/Aqueduct mock
  cards still fake (C-3).
- **Unblocker:** rebuild landing as Next.js route reading `/api/protocol/metrics`, OR
  patch the bundle's `PARTNERS`/`useState` to fetch real values.

### Flow 2 — Click "Open testnet" → onboarding
- **Entry:** `/` → landing CTA "Open testnet" → `/app/onboarding`.
- **Next:** Welcome → Authenticator → Faucet → Margin posted → Done.
- **Breaks at:** Faucet step renders `pending` honestly because Faucet contract is
  unstocked. Step 4 "Plinth · source built · deploy Month 1 W2" is stale copy (H-6).
- **Unblocker:** stock the Faucet (human task, documented). Update step 4 copy.
- **Verdict:** UI flow works end-to-end with the right honest-disabled states.

### Flow 3 — Passkey-bound smart wallet
- **Entry:** `/app/onboarding` step 2 OR `/verify/1` Connect button.
- **Next:** real `navigator.credentials.create()` WebAuthn ceremony.
- **Breaks at:** browsers without WebAuthn show "WebAuthn unavailable" disabled button —
  good.
- **Verdict:** works. The verifier step runner's empty state ("Connect with Postern")
  also routes here.

### Flow 4 — Claim a faucet drop of test USDC
- **Entry:** `/app/onboarding` step 3 OR `/verify/3` (faucet step in verifier).
- **Next:** click "Claim faucet".
- **Breaks at:** disabled today; honest reason "Faucet deploys with Coffer (Month 1 W2)"
  is shown but Faucet IS deployed at `0xb982…8549` — the contract is just unstocked. So
  the reason caption is wrong. A user is led to think Faucet doesn't exist when really
  it's unfunded.
- **Unblocker:** patch `/api/faucet/status` to report `{available: false, reason:
  "Faucet contract is deployed but not yet funded by Praetor. Stock arriving once
  Circle faucet drop lands."}`.

### Flow 5 — Deposit USDC into the vault
- **Entry:** `/app/vault` deposit card.
- **Next:** type amount → click Deposit → wagmi prompts approve + deposit.
- **Breaks at:** approve+deposit tx land on chain (Coffer is deployed). Then portfolio
  view stays at "no deposits yet" because subgraph isn't indexing Coffer (per
  AUDIT_USER_FLOWS.md). UI flow is fine; data pipeline gap.
- **Unblocker:** fix subgraph wiring (out of frontend scope).

### Flow 6 — Open a position on Hyperliquid
- **Entry:** `/app/trade`.
- **Next:** pick HL-HIP3, set size/leverage, click "Open long".
- **Breaks at:** wagmi's `useOpenPosition` resolves the adapter → fails with "Router not
  configured" today because AtriumRouter is deployed but `/api/deployments/address?slug=
  atrium-router` may not be returning it. UI shows error honestly.
- **Verdict:** UI flow is correct, depends on `/api/deployments/*` returning the new
  Phase-B addresses.

### Flow 7 — Cross-venue margin saving
- **Entry:** open position on a second venue from `/app/trade` after Flow 6 succeeds.
- **Next:** see `MarginEngineCard` recompute.
- **Breaks at:** depends on Flow 5 + 6 + Plinth indexing.
- **Verdict:** UI path correct; data dependency.

### Flow 8 — Portfolio shows real positions / P&L / liquidation buffer
- **Entry:** `/app/portfolio`.
- **Next:** read stat row → margin engine → positions table → activity rail.
- **Breaks at:** every panel reads `/api/portfolio/*` which today returns
  `{source: 'pending', …}`. UI renders `—` honestly. No fake data.
- **Verdict:** UI honest; needs subgraph and demo wallet to actually populate.

### Flow 9 — Sign mandate → agent acts → action log
- **Entry:** `/app/agents` → "New mandate" button.
- **Next:** fill IntentSigil form → wagmi `useSignTypedData` prompts the wallet.
- **Breaks at:** signing succeeds, intent hash shown, but no agent picks it up (agents
  not running). UI shows mandate row in "issued" state. Action log stays empty.
- **Verdict:** UI flow complete; depends on droplet bring-up.

### Flow 10 — Kill Switch
- **Entry:** `/app/agents` (kill switch shortcut) OR `/verify/7`.
- **Next:** confirm modal → wagmi `useKillSwitch.activate()`.
- **Breaks at:** PosternKillSwitch is deployed; activate() succeeds; loops through
  `activeKeys[user]` (empty if no mandate issued). Tx confirms with zero revocations.
- **Verdict:** Anticlimactic but UI-correct.

### Flow 11 — Verify balance in Merkle attestation
- **Entry:** `/app/reserves` → "Verify my balance" button OR `/verify/6`.
- **Next:** `useLanternVerify.verify()` reads latest attestation, computes proof in-browser.
- **Breaks at:** Lantern hasn't published; honest "no attestation published yet" surfaces.
- **Verdict:** UI honest, blocked on Lantern signing key.

### Flow 12 — Tax CSV with real trades
- **Entry:** `/app/tax`.
- **Next:** pick jurisdiction/year → click Download CSV/PDF/Signed.
- **Breaks at:** `TABLET_URL` unset → API returns pending → page shows "Tax service
  unavailable" empty state.
- **Verdict:** UI honest, blocked on Tablet deploy.

### Flow 13 — Cross-chain Aqueduct transfer
- **Entry:** `/app/transfer`.
- **Next:** pick chains/token/amount → click Transfer → timeline updates.
- **Breaks at:** Aqueduct has zero LINK balance, no allowed destinations set. Tx will
  fail at LINK transferFrom. UI surfaces error.
- **Verdict:** UI path complete; needs admin actions.

### Flow 14 — Mobile flows
- **Entry:** any of the above on mobile UA.
- **Next:** middleware rewrites `/` → `mobile-landing.html`, `/app/*` → `mobile-app.html`.
- **Breaks at:** mobile-app.html is a clickable mockup. Every primary button is dead.
  See C-2 in full.
- **Verdict:** **15/15 mobile flows broken**. Single biggest finding.

### Flow 15 — Judge runs 7-step Verifier walk
- **Entry:** `/verify/1`.
- **Walk:**
  - Step 1: Deposit USDC into Coffer. Wagmi-wired. Coffer deployed. Tx works. Subgraph
    won't reflect → button shows success-with-Arbiscan-link, page won't update. Honest.
  - Step 2: Open hedged position. `pending-blocker` because Plinth/Router wiring not in
    `useOpenPosition` step-list — fires "Step contract not yet deployed" message. Honest.
  - Step 3: Trigger margin recompute. Same.
  - Step 4: Inject chaos. `/api/chaos/inject` returns "PRAETOR_CHAOS_URL not configured".
    Honest.
  - Step 5: Trigger liquidation. Same as step 2.
  - Step 6: Verify proof of reserves. `useLanternVerify` returns "no attestation".
    Honest.
  - Step 7: Kill Switch. Confirm modal → wagmi → zero revocations. Tx confirms. Honest.
- **Verdict:** UI walk is 100% complete and honest. Every step disables the action with a
  named blocker per `LAUNCH_READY.md`. This is the strongest single surface in the app.

## What's actually correct (kudos)

- **`/verify/[step]` + `VerifierStepRunner`:** best-designed surface I read. Real wagmi
  hooks per step, real deployment-readiness check, honest empty-state when no wallet,
  permission-state for wrong chain, error-state with retry, success-state with
  Arbiscan-link. No fake tx hashes.
- **`/app/onboarding`:** real WebAuthn ceremony, no `setTimeout(2.4s)` fake delay,
  faucet API gated honestly, margin step shows `pending` not `$46,500`.
- **`CohortGrid`:** honest empty state with reason. No fake logos. Validates Scribe
  responses to defend against malformed BigInt strings.
- **`SettingsTabs`:** 5/6 tabs scaffolded honestly with per-tab month banner. No silent
  toggles like the audit-P-6 predecessor.
- **`TopUpBanner` + top-up modal:** banner only fires below threshold; modal uses real
  vagi deposit, shows the same two-prompt flow as the vault page, success links to
  Arbiscan.
- **`ChaosPage`:** error branches captured per audit J-C3; renders `chaos_inject_503`
  with detail when off-chain service is down. Honest 503 instead of fake success.
- **Banned-words sweep clean.** The linter test
  (`apps/verify/src/lib/writing-banned-words.test.ts`) actively guards user-facing copy.
- **Wagmi route-scoping:** `/app/*` has its own layout that loads wagmi via
  `dynamic(…, {ssr: false})` so the landing doesn't ship the 150 KB viem+connectors
  bundle. `/verify/[step]` mounts wagmi only inside the step runner. Correct per
  `ui.md §3.4` "Defer wallet libraries until the user clicks Connect".
- **Honest error states everywhere I looked.** Top-up modal "humanizeTopUpReason",
  vault deposit "check / approve / depositing / success / error" state machine, transfer
  form's named-blocker disabled state.
- **`/lantern`, `/cohort`, `/cohort/[id]`** all honour "no attestation yet" / "no
  partners yet" instead of faking activity.
- **Onboarding's WebAuthn ceremony** correctly surfaces the real browser error message
  on dismiss rather than a generic "try again".
- **Wordmark and brand kit** — `/brand` is a real source-of-truth page with palette
  swatches, type scale, button states. Sample cards explicitly labelled "value slot"
  not "$12K · live".

## One-line summary per the report ask

Honest React app, dishonest static HTML. Fix the three `apps/verify/public/*.html` files
(C-1, C-2, C-3) and the `/app/page.tsx` aside (C-5) and the front-end is launch-honest. The
mobile-app clickable mockup is the single biggest remaining gap; the right fix is to
port `/app/*` to responsive React and delete the middleware rewrite, 5-10 days of work.
