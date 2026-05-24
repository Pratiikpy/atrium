# Atrium professionalism audit — 2026-05-24

Auditor F. Scope: the polish overlay. Not "does it work" (Auditors A/B/C/D/E covered correctness); the question here is whether Atrium *feels* like a serious institutional-grade product when a real prime-brokerage client lands on it. Synthesises the other five audits where they bear on perception, then adds the feel/finish layer.

---

## Headline

**Almost. The product has the right bones and a real voice — but the front door lies, and a serious visitor will catch it inside ten seconds.**

The React app (`apps/verify/src/app/**`) is the most credible surface Atrium owns today. The Verifier walk, onboarding, vault, portfolio, agents, transfer, reserves, cohort grid, settings, manifesto, team, security, brand kit — every one of these reads like a human cofounder wrote it, ships every required state, refuses to fake numbers, and matches the parchment/ink/Instrument Serif brand discipline cleanly. Voice is unusually consistent. There is no neon, no emoji, no marketing sandwich, no "we are excited to announce." The Verifier step runner is the single best-built surface I read in any startup at this stage; it is genuinely institutional.

But none of that is what a desktop visitor sees first. They see `apps/verify/public/landing-v2.html` (1.6 MB self-contained bundle) which hard-codes a `useState(4.13)` random-walk TVL ticker, an 8-name fake partner array (`Pendle Labs / Variational / Horizen / IOSG / Robinhood Chain / Hyperliquid / Aave Labs / Coinbase`), and a $12,378,422 portfolio mock with a "live" pill on top. A mobile visitor sees `mobile-landing.html` and `mobile-app.html`, where the same lie repeats — Plinth card with a "live" pill over `$12,374,820` (`mobile-landing.html:961`), six per-venue dollar amounts (`mobile-landing.html:911-929`) that never hydrate, and an entire vanilla-JS app shell where every primary button (`Open long`, `Move $50,000 USDC`, `Manage`) does nothing.

The React layer earned the credibility. The static layer hands it back. The fix is mechanical, not architectural — but until it lands, the front door betrays the rest of the house.

A Goldman desk lead clicking through today would walk away within two minutes — not because the product is weak, but because the first surface they touched used a random-number ticker labelled "Live testnet TVL". That single signal disqualifies the team in their head before they reach the Kani badge or the verifier walk.

---

## The first-30-seconds verdict

**Visitor:** Wintermute desk lead lands on `verify.atrium.fi` (or whatever subdomain ships) on a MacBook in Chrome.

**Second 0-5.** Loading state: black `#0E0E0F` page with serif italic "Atrium" wordmark + amber underline rendered as inline SVG. **Earns credibility.** Restrained, on-brand, no spinner gif. Status: "Unpacking…" in the corner.

**Second 5-15.** Bundle decompresses; the landing comes up. Hero: "One wallet. Every venue. One number." in Instrument Serif italic, parchment background, warm prime-brokerage feel. Right-side balance card shows `$12,378,422` buying power with `$4.13M collateral · 3.12× ratio · 38.4% utilisation · 14 open positions`. **A serious visitor pauses on that number.** $12M TVL on a buildathon-stage testnet would be remarkable — they look for the source link. There isn't one.

**Second 15-25.** They scroll. "Live testnet TVL: $4.13M" with a hardcoded "+ 41.2% vs 30d ago" subtitle, drifting up and down by ~$5K every few seconds. **That's the moment.** A real quant has seen a thousand decks with seeded random-walk tickers; the pattern is instantly recognisable. They open devtools, find `Math.random()` in the bundle within fifteen seconds. **Credibility burnt.**

**Second 25-30.** They scroll past the "Built with" strip: Pendle / Variational / Horizen / IOSG / Robinhood Chain / Hyperliquid / Aave Labs / Coinbase. They've never seen Atrium in any of those firms' announcements. They close the tab.

**Verdict — would they take a meeting?** No. Not because of the math, the contracts, the architecture, or the team — all of which would have earned the meeting if reached. Because the first signal was a random-number ticker on the front door, and the second was eight partner names that don't exist. The same visitor, landing on `/verify/1` first, would have walked away ready to introduce the team to a portfolio company. The opener killed the meeting before any of the substance was reached.

**Specific signals that earn credibility (when reached):**

- The wordmark + amber underline loading splash (landing-v2.html SVG block) — quietly excellent.
- The Verifier step runner's "Step not wired yet" honest warning + disabled button (`apps/verify/src/components/verifier-step-runner.tsx:223-233`).
- The manifesto's "What we will not do" list (`apps/verify/src/app/manifesto/page.tsx:42-49`) — five bullets each of which is a verifiable commitment, not a value statement.
- The team page using F1/F2/F3 codenames rather than fake-named bios (`apps/verify/src/app/team/page.tsx:31-47`).
- The cohort section's honest empty state (`apps/verify/src/components/landing/cohort-section.tsx:29-35`).
- The brand kit (`apps/verify/src/app/brand/page.tsx`) — palette, type scale, button states, all sourced.

**Specific signals that lose credibility (first 30 seconds):**

- `apps/verify/public/landing-v2.html` random-walk TVL ticker (`Math.random()` inside `useState(4.13)`).
- The `PARTNERS = ["Pendle Labs", "Variational", "Horizen", "IOSG", "Robinhood Chain", "Hyperliquid", "Aave Labs", "Coinbase"]` literal in the same bundle.
- The static `$12,378,422` / `$4.13M` / `3.12×` / `38.4%` / `14 positions` dashboard mock in the bundle.
- On mobile UA: the `mobile-landing.html:893` SSR `$12.37M` and the `mobile-landing.html:911-929` per-venue dollar amounts that never hydrate.

---

## The 20-question rubric scoring

Score legend: **1** broken · **2** weak · **3** acceptable · **4** strong · **5** institutional.

### 1. Voice consistency — **4**
Genuinely strong, with two surface defects. The React app, manifesto, team page, security page, brand kit, docs index, footer copy, judge one-pager, README, SECURITY.md, CONTRIBUTING.md all sound like the same human wrote them — short sentences, named verbs, no marketing sandwich, no banned words (Auditor E + B both confirmed banned-words sweep clean). The two cracks:
- `apps/verify/src/app/app/page.tsx:52-57` Live-status panel reads "Source built · deploy Month 1 W2" four times. Stale (Plinth/Coffer/Sigil/Vigil are deployed today) and bureaucratic — the rest of the app speaks in named blockers.
- `apps/verify/public/mobile-app.html` has 27 exclamation marks — the rest of the codebase uses near-zero. Pulled in from the design HTML without a copy pass.

### 2. Restraint — **4**
No emoji storm, no neon, no rocket icons (`grep` for 🚀/🎉/✨/💯/🔥/⚡ in `apps/verify` returned zero). The status badge uses amber for testnet, not green-by-default. Sigil section dark canvas (`rgb(16,16,16)`) is the only inversion and it's intentional. Two minor restraint defects:
- The static landing's "Unpacking…" loading copy is informal where everything else is precise. "Loading" would land cleaner.
- Mobile-app.html's "All ↗" / "New ↗" pattern uses the up-arrow as an exclamation-substitute on at least eight surfaces; the prototype uses it once. Reads as visual noise on the small screen.

### 3. Typographic discipline — **3**
Display Instrument Serif italic is correctly reserved for headlines, the wordmark, and the "do not" example card in the brand kit. Geist body throughout. Geist Mono on hashes/addresses/numbers correctly. Two defects:
- `apps/verify/src/components/settings/subnav.tsx:25-32` uses ascii glyphs (`✦ ◉ ◐ ⇌ ♬ ◌`) as tab icons — feels like a placeholder, breaks the otherwise clean SVG-icon set used elsewhere (already flagged D-4 by Auditor B).
- Letter-spacing: the design tokens specify negative tracking down to `-0.025em` on display sizes; the React landing hero (`hero-section.tsx:16`) renders `text-[40px] sm:text-[56px] md:text-[76px]` but the underlying CSS class `.font-display-hero` (in `globals.css`) doesn't apply the prototype's `-2.6229px` letter-spacing at the 87px size — wordmark feels slightly looser than the prototype.

### 4. Color discipline — **4**
Auditor B confirmed banned-color sweep is clean for the React app. The semantic palette extends the four confirmed prototype tokens (parchment, ink, terracotta, archway underline) with restrained near-neutrals for status (success `#2D6A4F`, warning `#B8860B`, danger `#C04A39`, info `#1E3A5F`). The status triplet for the breathing favicon (amber `#CC8E2D`, green `#43864F`, red `#A1352A`) is grounded and consistent. One concrete deviation: `apps/verify/src/components/landing/cohort-section.tsx:30` uses `bg-parchment-soft/40` — the design tokens specify `parchment.warm` (oklch 0.96 0.005 85). Close but not identical; minor.

### 5. Spacing rhythm — **3**
The React `/app/*` pages match the prototype's dense card rhythm well. Vertical spacing between sections is consistent at 80px / 96px / 12px between cards. Two specific gaps:
- The desktop landing (the React `/legacy` and the static landing-v2 bundle) keep the prototype rhythm; the mobile landing (`mobile-landing.html`) breaks rhythm at the cohort-strip section (line 1117 — the "Open to applications" honest card is centred but its 18px padding doesn't match the surrounding 24px section rhythm).
- `apps/verify/src/app/app/page.tsx:50` aside has 24px padding but the prototype's Atrium App shell uses 22-32 depending on density. Not jarring; not pixel-perfect.

### 6. Loading + empty + error states — **5** on React, **1** on static HTML
React: this is where the team is strongest. Every component I read (verifier-step-runner, onboarding-flow, cohort-section, lantern-dashboard, settings-tabs, vault-deposit, transfer-form) implements empty / loading / error / permission / success with named blockers ("Faucet contract is deployed but not yet funded by Praetor"). The `honest-pending.test.ts` and `writing-banned-words.test.ts` enforce this at CI level.

Static HTML: `mobile-app.html:1477-1481` explicitly catches API errors and **leaves the design placeholders in place** with a code comment naming the trade-off — direct violation of `.claude/rules/ui.md`. `mobile-landing.html:911-929` per-venue dollar amounts never hydrate at all. The static surface is where the rule breaks live.

### 7. Microcopy + buttons — **4**
Every React-side button verb is short and precise: "Open testnet", "Run the 90-second proof", "Run step 5", "Connect with Postern", "Try again", "View on Arbiscan", "Apply ↗". Helper text is grounded ("Postern issues a passkey-bound smart wallet"). Two defects:
- `apps/verify/src/app/app/page.tsx:26` uses `Set up account →` — the arrow is fine, but "Set up account" is generic compared to "Open testnet". Replace with "Begin onboarding" or "Get a wallet".
- Mobile-app.html buttons like "Open long · rTSLA-PERP" promise specificity then do nothing — the verb is right but the wiring betrays it.

### 8. Honesty in surface — **2**
This is the single biggest gap and the main reason the headline is "almost" not "yes". Synthesising prior audits + this walk:

**Confirmed honesty defects on shipped surfaces:**
- `landing-v2.html` random-walk TVL ticker + 8 fake partner names (C-1 in Auditor B).
- `mobile-landing.html:893` SSR `$12.37M` first-paint.
- `mobile-landing.html:911-929` six fake per-venue dollar amounts that never hydrate.
- `mobile-landing.html:958-988` Plinth mock card `$12,374,820 / $4.13M / 3.0× / 38.4%` with "live" pill (line 961).
- `mobile-landing.html:1020-1021` Aqueduct `50,000 USDC ≈ 8.4s · $0 fee`.
- `mobile-landing.html:1073-1088` four stats sub-deltas ("+ 41.2% · 30d", "8 with open positions") that don't hydrate.
- `mobile-app.html` entirely hardcoded: $12,374,820 hero, 4 fake positions, 5 fake agents (delphi.eth, pareto.eth, helios.eth, kepler.eth, aurora.eth), atrium.eth ENS, 0x1a3b…7f29 wallet, $50,000 fake transfer, fake activity log.
- `apps/verify/src/components/app-shell.tsx:144` hardcoded sidebar wallet `0x1a3b…7f29` (H-2 in Auditor B).
- `apps/verify/src/app/app/page.tsx:52-57` Live-status panel reading "Source built · deploy Month 1 W2" when contracts are deployed (C-5 in Auditor B).
- `apps/verify/src/app/app/markets/page.tsx:66` static "live source" pill on every venue without RPC check.
- `apps/verify/public/kani-status.json` hand-edited to "pass · 5 of 6" when 0 of 9 Kani proofs have ever actually run (E-headline).
- `JUDGE_ONE_PAGER.md:32` "Praetor 3-of-5 multisig + 48h timelock" when every contract has the deployer EOA as `praetor_multisig` (E-Honesty audit).
- `apps/verify/src/app/security/page.tsx:26` "Praetor 3-of-5 multisig plus 48-hour PraetorTimelock on every parameter change" — same issue, same fix.
- `apps/verify/src/app/security/page.tsx:25` "3-keeper redundancy with economic slashing" — Vigil has zero active keepers per Auditor A (stake threshold is 1000 ETH; not stocked).
- `subgraph/subgraph.yaml:381,418` Rostrum + AtriumRouter data sources point at `0x0000…0000`; subgraph will never index them.

**The pattern:** the React app is honest. The static HTML is dishonest. The pitch docs (one-pager, security) make tense-confusion errors (present tense about Day-365 design intent). Fixing the static layer + retensing the docs takes a couple of focused days and would lift this score from 2 to 5 without touching any code in `/app/*`.

### 9. Density vs whitespace — **4**
The React `/app/*` and the prototype-aligned mobile shell both honour the institutional dense-but-readable rhythm. Cards carry the prototype's 22-24px padding, 12-16px between, 1.55 line-height, generous tabular numerals. The desktop landing (the React `/legacy` version) is the same. Two notes:
- The `apps/verify/src/app/app/page.tsx` home is sparser than the prototype Atrium App home (only 3 tiles + an aside; the prototype has 4-5 rows of dense panels). A serious user lands here after onboarding and feels under-loaded.
- The `/security` page is too sparse for what it carries — three blocks of bullet points, lots of whitespace, no sub-bullets, no per-claim source link. An institutional reader expects more density on a security page (compare Chainlink Labs / Lido docs).

### 10. Animation + interaction timing — **3**
Hard to fully verify without running every surface. From component-level grep:
- The React verifier-step-runner uses `animate-spin` (Tailwind default) on the loader, which is 1s linear — matches the prototype's "breathing" 0.6s loosely but isn't the prototype's `cubic-bezier(0.2, 0.7, 0.2, 1)` 200ms card lift.
- Most React components use `transition-colors` (Tailwind default 150ms ease) rather than the prototype's `color 0.12s` / `border-color 0.16s` / `card_lift 0.2s cubic-bezier(0.2, 0.7, 0.2, 1)` from `desing/extracted/full-render-tokens.json:92-101`.
- Static HTML (mobile-landing, mobile-app) does match the prototype timing well — the design HTML's CSS came along for the ride.

Net: the React app feels slightly "tailwind generic" on hover/focus where the prototype feels prime-brokerage smooth. A 4-hour pass updating the `.transition-*` utility classes to the prototype tokens would lift the whole feel.

### 11. Verifier walk feel — **5**
Best surface in the product. `/verify/1`..`/verify/7` is institutional-grade. The `VerifierStepRunner` (`apps/verify/src/components/verifier-step-runner.tsx`):
- Wagmi only mounts inside the step (no bundle penalty on the landing).
- Empty state: "Connect a wallet to run this step. Postern passkey works without a browser extension." (line 63-64) — informs, doesn't beg.
- Permission state: "Switch to Arbitrum Sepolia" with current chain named (line 86-91).
- Disabled-with-reason: "Step not wired yet · The contract for step {step} is not registered in this network's deployment file. The button is disabled until F1 lands the wiring (Month 2 W1 per docs/ROADMAP.md)." (line 226-231).
- Kill switch confirm modal (line 173-177) is the right friction.
- Tx hash → Arbiscan link only renders when regex passes (line 252-267).
- Error state names a cause + offers "Try again" (line 269-282).

If a judge ran the walk on a wired surface, they would leave satisfied that this team builds real product. **The remaining issue is that 4 of 7 steps are gated on contract wiring per Auditor D — the surface itself is institutional; the substrate underneath isn't yet.**

One specific verifier-step copy defect: `apps/verify/src/app/verify/[step]/page.tsx:60` Kill Switch body says "Every Sigil mandate revoked. Every Postern session key cancelled." — when in current state, the call revokes zero things (no mandates exist). Per Auditor A C-2/C-3 (Sigil/Vigil not initialized) this is an honesty issue worth a sub-line: "Today: revokes zero mandates because none have been issued."

### 12. Mobile feel — **1**
The static `mobile-landing.html` and `mobile-app.html` are beautifully styled — OLED dark, glass tabbar, hero card, Instrument Serif italic preserved, the right typographic discipline. **And they are clickable mockups.** Per Auditor B C-2: zero wagmi, every primary button dead, fake data hardcoded, hydration script explicitly preserves placeholders on API error. Per Auditor B's per-button table, 12 of 16 mobile-app interactive elements do nothing.

A real institutional client opening Atrium on their iPhone will land on a screen labelled "Buying power: $12,374,820 · live" and tap "Open long · rTSLA-PERP" — and nothing happens. That experience is worse than a "coming soon" page, because the polish promises a real product the buttons can't deliver. Auditor B's recommended fix (port React `/app/*` to responsive + delete the middleware rewrite) is the right call but is 5-10 days of work. The shorter band-aid (disable every dead button with an honest tooltip + always clear placeholders on missing data) is 2 hours and would lift this from 1 to 3 immediately.

### 13. Footer + chrome — **3**
React landing footer (`apps/verify/src/components/landing/footer.tsx`) is genuinely well-built — 4 columns with real destinations, plaintext fallback for unbuilt pages with a `title="No destination yet"` tooltip rather than dead `href="#"`. Status pill "testnet · contracts pending" with amber dot. Wordmark in italic. This is the model.

Defects:
- `mobile-landing.html:1148-1160` ships 10 `href="#"` footer links — direct opposite of the React footer pattern (H-7 / C-4 in Auditor B).
- The desktop landing-v2.html footer (inside the bundle) — same problem per Auditor B.
- AppShell topbar (`app-shell.tsx:155-167`) renders breadcrumb as `[{ label: 'Atrium' }]` default — every `/app/*` page that doesn't pass a breadcrumb just says "Atrium". That's not a chrome bug, it's an unfinished surface.

### 14. Documentation polish — **3**
`/docs` page (`apps/verify/src/app/docs/page.tsx`) is a single-screen card grid linking out to GitHub markdown. It works as an index but doesn't read like institutional docs (compare Chainlink, Aave, Uniswap docs sites). Specific defects:
- M-3 from Auditor B: `docs/LAUNCH_READINESS.md` link points to a file that doesn't exist under that name at repo root (it's `LAUNCH_READY.md`).
- The "ADR-001 through ADR-012" section (line 95-102) refers to records that aren't linked or surfaced — empty signal.
- The `human_left.md` link (line 54) exposes the working scratch log to public visitors. Per Auditor E this file shouldn't ship in a public repo without sanitisation; per `.claude/rules/git.md` "Public repo readiness".

`/security` page is shorter than the SECURITY.md it summarises and uses present tense for design intent — fix per Honesty section above.

### 15. Brand kit (`/brand`) — **4**
The page (`apps/verify/src/app/brand/page.tsx`) renders wordmark sizes, palette swatches with hex + note + semantic role, typography specimens, button states. It is the right surface for what it does. Compared to the prototype `desing/Brand Kit.html` (878 lines, 7 sections including Voice + Trademark + Download with actual asset links): the React page is a subset. The prototype's Voice section ("We are precise, restrained, architectural, quietly confident. We are not hyped, memed, decorative, approximate, revolutionary") is a real cultural asset; not surfaced in the React /brand. The prototype's ✗ Don't example ("Atrium revolutionises onchain capital efficiency with next-generation prime brokerage infra. Marketing slop. Vague. Borrowed from every other DeFi pitch deck.") is a teaching moment that would make any cofounder or new hire instantly grok the voice — not in the React /brand.

### 16. 404 + 500 surface — **3**
`apps/verify/src/app/not-found.tsx` is on-brand: wordmark hero, "That page is not here. Maybe it was a step we have not built yet, or a link that drifted." and a "Back to Atrium" CTA. Honest voice, no marketing fluff. Strong.

I did not find a corresponding `error.tsx` for 5xx handling at the app root — Next.js default error UI will surface for server errors, which is the generic "Application error: a server-side exception has occurred". On a serious product this is a polish miss; institutional users hit 500s during demos.

### 17. First-30-seconds story — **3** (see verdict section)
Headline: "One wallet. Every venue. One number." — strong, specific, in voice.
Sub: "Atrium is a unified margin prime brokerage for the EVM. Post collateral once on Arbitrum. Trade across the seven onchain venues Atrium supports with one buying-power figure, recomputed in real time by a Stylus margin engine." — strong, names the mechanism.
Primary CTA: "Open testnet ↗" — verb is right.
Secondary CTA: "Run the 90-second proof" — excellent, sets expectation.
Trust signal: the immediate sub-fold "$12.37M live testnet TVL" (random walk) is the trust-killer. Replace with the Kani CI badge + real subgraph block-height + real contract addresses, and this becomes a 5.

### 18. Last-30-seconds story — **3**
A visitor who scrolls to the bottom of `/legacy` (the React landing) finds: a cohort section honest-empty, the architecture diagram, the closing CTA "Step inside. The testnet is open. Faucet drops $10,000 test USDC and $5,000 rAAPL on landing." (the faucet promise is also conditional today — Faucet contract is deployed but unstocked per Auditor A wiring table). Footer is real with real links.

A visitor who scrolls to the bottom of the static `landing-v2.html` finds the same kind of content but rendered from the dishonest bundle (the partner array, the random ticker, etc.). The "closing" feel betrays the trust the middle gained back.

A visitor who hits `/docs` finds GitHub links. A visitor who hits `/security` finds design intent presented as present tense. A visitor who hits `/manifesto` or `/team` finds honest, founder-voiced copy — these read like the team.

Net: bottom-of-experience is mixed. The handcrafted React pages reward scrolling; the static surfaces and pitch pages punish it.

### 19. Press / sales surface — **3**
`JUDGE_ONE_PAGER.md` is mostly honest. Auditor D identified three outright violations: (1) "Built on Arbitrum + Robinhood Chain testnet" implies dual-live where RH SDK hasn't shipped; (2) "Praetor 3-of-5 multisig + 48h timelock" presented as shipped (it isn't); (3) the cohort-of-named-partners claim contradicting the landing's fake partner strip.

Strong parts: the Jamie hook is concrete with a footnote pointing at a backtest notebook; the "Why now" table cites four real public signals; the "Verifiable surfaces" table is honest about per-surface deploy month. The asks section is concrete (Top-3, Founder House, warm intros) without padding.

Rephrase the three over-claims and this one-pager is a 5.

### 20. Email / handoff polish — **4**
`SECURITY.md` is short, specific, and routes to a real-looking `security@atrium.fi` address with PGP. In-scope / out-of-scope laid out cleanly. "Hall of fame" section gracefully handles the "none yet" case.

`CONTRIBUTING.md` lays out the two paths (build an adapter, build an agent) with concrete steps and a stated $5K ARB grant per accepted adapter — currently the grant requires Praetor multisig live per Auditor D / B M-11. Add a line clarifying current status.

`README.md` opens with a one-line product description and a `make demo` quickstart. Clean. Reads like a real company's external repo. The "Repo layout" tree is honest and pruned.

Minor polish: `SECURITY.md` line 37 lists "3-keeper redundancy with economic slashing. Vigil contract scaffolded; live keeper deployment lands Month 2." — that's honest framing. Apply the same framing to the multisig + Kani lines in JUDGE_ONE_PAGER.md.

---

## Honesty defects (deduplicated polish overlay)

Already covered exhaustively in dimension 8 above. Cross-referenced unique entries not in prior audits:

- `apps/verify/src/app/manifesto/page.tsx:54`: "Keep the contracts upgradeable behind a 48-hour timelock and a 3-of-5 multisig" — present tense for an intent. Same pattern as security page.
- `apps/verify/src/app/team/page.tsx:33-46`: F1/F2/F3 codenames are correct, but the "Open-source history visible on GitHub" line under each ships even when the repo has zero commits per Auditor E. Either gate the line behind real repo activity or rephrase to "GitHub history opens after the buildathon submission."
- `apps/verify/public/mobile-app.html:1267`: `atrium.eth` ENS shown next to the wallet — Atrium has not registered an ENS for the project (no record on `human_left.md`); rendering it implies ownership we don't have.
- `landing-v2.html` shows "+ 41.2% vs 30d ago" as static string subtitle — implies 30-day history exists. Project is < 30 days old by any honest read.
- The 8 venue logos in mobile-landing.html (HL-HIP3, AAVE-V3, TRADE, PENDLE, HL-HIP4, CURVE) — names are factually venues Atrium has adapters for, but the dollar amounts next to each are invented and the bar fills (32% / 26% / 39% / 15%) are decorative.

---

## Voice + tone defects

- **landing-v2.html bundle (desktop)** — "Live testnet TVL" labelling a Math.random() value. Recommend: replace with `Testnet TVL · pending Coffer deposits` or wire to `/api/protocol/metrics` and show `$0.00` when empty.
- **landing-v2.html bundle** — "+ 41.2% vs 30d ago" static delta. Recommend: drop the delta, or render "30-day series begins once Scribe accumulates 30 days of indexed blocks."
- **mobile-landing.html:884** "Plan view · live testnet" — labels a static design illustration as "live". Recommend: "Plan view · design preview".
- **mobile-landing.html:961** `<span class="pill">live</span>` over `$12,374,820` mock. Recommend: change pill to "design preview" or remove and wire to `/api/protocol/metrics`.
- **mobile-landing.html:1166** footer baseline "testnet · all systems normal" without source. Recommend: pull from `/api/protocol/subsystems` and render the real subsystem-health summary.
- **mobile-landing.html:1131-1132** "Faucet drops $10K test USDC + $5K rAAPL." — promise. Faucet contract is currently stocked with 40 USDC per Auditor A. Recommend: "Faucet drops up to 100 USDC. Currently stocked for 8 demo claims."
- **mobile-app.html** — 27 exclamation marks scattered through the design copy ("delphi.eth opened rTSLA-PERP long" with "+1.2% · 5min ago!" style). The rest of the codebase uses near-zero exclamation. Recommend: copy-pass to remove them.
- **apps/verify/src/app/app/page.tsx:52-57** four rows of "Source built · deploy Month 1 W2" — bureaucratic, stale. Recommend: replace with a `useQuery` against `/api/deployments/status` and render real deploy/activation state, or remove the panel entirely.
- **apps/verify/src/components/onboarding/onboarding-flow.tsx:409** "● Plinth · source built · deploy Month 1 W2" — same stale wording. Recommend: "● Plinth · margin pending Scribe index" (per Auditor B H-6).
- **JUDGE_ONE_PAGER.md:32** "Praetor 3-of-5 multisig + 48h timelock" — present tense. Recommend (per Auditor E): "Praetor multisig + 48h timelock infrastructure (deployer-key today on testnet; 3-of-5 Safe before mainnet flip)."
- **JUDGE_ONE_PAGER.md:32** "5-invariant Kani+proptest formal-verification target in CI." — reads as live. Recommend (per Auditor E): "5-invariant proptest target in CI (Kani lane scheduled)."
- **JUDGE_ONE_PAGER.md:3** "Built on Arbitrum + Robinhood Chain testnet" — implies both live. Recommend: "Built on Arbitrum Sepolia today; Robinhood Chain adapter ships within 14 days of the RH SDK going public."
- **apps/verify/src/app/security/page.tsx:25-26** "3-keeper redundancy with economic slashing" + "Praetor 3-of-5 multisig plus 48-hour PraetorTimelock on every parameter change." — same fixes; reword as design intent + named gap.
- **apps/verify/src/components/landing/hero-section.tsx:30-32** "Trade across the seven onchain venues Atrium supports" — adapter count is 9 deployed; "seven" is stale. Recommend: pull venue count from `/api/protocol/subsystems` and render live, or update to "nine" with a footnote about whitelist status.
- **README.md line 17** "Precondition: Stylus contracts… need a linker that resolves the Stylus WASM host symbols. Linux, macOS, and WSL work; Windows MSVC currently does not — see `human_left.md` #11." — `human_left.md` is the founder scratch log. Linking it from a public README per Auditor E erodes the polish; sanitise the link or move the constraint into a proper SETUP.md.

---

## Polish defects (specifics)

- **/docs page** references `docs/LAUNCH_READINESS.md` which is named `LAUNCH_READY.md` at root (M-3, Auditor B).
- **/agents/marketplace** "Submit on GitHub" CTA points at `https://github.com/Pratiikpy/atrium` — a personal fork URL (M-2, Auditor B). Should be the canonical org URL once one exists, or omit until it does.
- **AppShell sidebar** wallet card `0x1a3b…7f29` is the prototype-copied placeholder; should read `useAccount()` (H-2, Auditor B).
- **AppShell sidebar** missing nav entries for `/app/markets` and `/app/notifications` (H-3, Auditor B).
- **AppShell breadcrumb** defaults to `[{ label: 'Atrium' }]` — every `/app/*` page that doesn't pass a breadcrumb shows just "Atrium" in the topbar.
- **/changelog** is a hardcoded `WAVES[]` array (M-4, Auditor B). Either generate at build time or mark explicitly "Updated manually; canonical source is `docs/AUDIT_FINDINGS.md`".
- **/legacy** page exists — confusing route name; either rename or remove (M-7, Auditor B).
- **/security** uses present tense for design intent; should match SECURITY.md framing.
- **Settings tabs** use ascii icons (`✦ ◉ ◐ ⇌ ♬ ◌`); replace with lucide/inline-SVG (D-4, Auditor B).
- **Settings 5/6 tabs** all show the same "coming Month X" banner (M-9, Auditor B). Differentiate body copy per tab.
- **Sidebar "Reserves · ✓"** badge is hardcoded `'✓'` (M-5, Auditor B) — implies attestation success without reading state.
- **Sidebar "Agents · 0"** badge is hardcoded `'0'` (M-5, Auditor B) — could be a real `useQuery`.
- **Kani badge** ships hand-edited `public/kani-status.json` saying "pass · 5 of 6" (E-headline). Replace with `state:'unknown'` or delete and let CI populate.
- **Lighthouse audit** never run on `/` (H-8, Auditor B). Cannot claim mobile-≥-90 until measured.
- **landing-v2.html bundle** is 1.6 MB. The 250 KB rule (`.claude/rules/ui.md §3.4`) carves out "self-contained marketing HTML" — but 1.6 MB is past any reasonable carve-out for TTI.
- **No `error.tsx` at app root** — default Next.js 500 page on demo day would be brutal.
- **Foot-base** on `mobile-landing.html:1166` "testnet · all systems normal" hardcoded — should reflect real subsystem health.
- **Status pill** on AppShell sidebar (`app-shell.tsx:84-87`) shows "testnet" amber — fine, but doesn't link anywhere. A clickable status pill that opens `/sla` or `/lantern/sla` would be a real institutional touch.

---

## What feels truly institutional today (kudos)

These surfaces would survive an institutional pitch even tomorrow:

- **`/verify/[step]` + `VerifierStepRunner`.** The single best surface. State machine is right, copy is right, disabled-with-reason is right, Arbiscan link is right. Built for the judge use case.
- **`/app/onboarding` (4-step flow).** Real WebAuthn ceremony, faucet honest-pending, margin step shows `pending` not `$46,500`, no `setTimeout(2.4s)` fake delays. Reads as a serious product.
- **Manifesto (`/manifesto`).** Five verifiable commitments in "What we will not do", five verifiable commitments in "What we will". No marketing soup. "Written before the contracts deployed. Read again after they do. The claims should still hold." — that line is rare.
- **Team page (`/team`).** F1/F2/F3 codenames, three-paragraph "How we work" with five operating principles. No fake bios, no fake LinkedIns, no fake VCs-who-backed-us claims.
- **Cohort grid (`/cohort`).** Honest empty state, Scribe-validated response shape, clear "Outreach in progress · count auto-populates from Scribe" sub. Sets the standard the static landing should match.
- **Landing footer (React `LandingFooter`).** 4 columns, real destinations, plaintext fallback for unbuilt pages — model implementation; absolute opposite of the static landing's `href="#"` rot.
- **Wordmark + amber underline loading splash** in `landing-v2.html`. Quietly excellent. Restrained, on-brand, no spinner.
- **Codex x402 middleware** (per Auditor E): 22 tests covering payer-spoof, replay, chain-truth binding. This is real institutional rigour even though invisible to a UI walk.
- **Honest-pending discipline.** `apps/verify/src/app/api/honest-pending.test.ts` enforces every "pending" route returns `null` literals instead of fake-zero numbers. Banned-words sweep (`writing-banned-words.test.ts`) catches user-facing copy regressions. The "checked in tests for honesty" pattern is institutional behaviour I do not see at most startups.
- **Brand voice section in `desing/Brand Kit.html:738-787`.** "We are precise, restrained, architectural, quietly confident." The ✗ Don't card naming "Marketing slop. Vague. Borrowed from every other DeFi pitch deck." would make any new hire instantly grok the voice in 30 seconds. Port this section into `/brand` to lift the React kit.

---

## Top 10 fixes that would change the "feel"

Ranked by feel-per-hour, highest first.

1. **Burn `landing-v2.html` and replace `/` with the React `/legacy` page (renamed).** 4-6 hours. Removes the random-walk TVL, the 8 fake partner names, the $12.37M dashboard mock, the 1.6 MB bundle, and the dev-mode-Vite hangover all in one move. Per Auditor B C-1/H-8/M-10. **This single fix is the highest-leverage perception lift in the whole product.** Without it, every other polish wave is undermined by the front door.

2. **Replace `apps/verify/public/kani-status.json` with an honest `state:'unknown', passed:null, total:9` payload.** 5 minutes. Fixes the 5 failing frontend tests, drops the structurally-dishonest Kani badge, lets CI populate on first push (Auditor E Tier-1 #1). The Kani lie is small but it's the kind of thing a serious security reader catches and remembers.

3. **Rewrite `JUDGE_ONE_PAGER.md:32` (and `apps/verify/src/app/security/page.tsx:22-30`) to honest design-intent framing.** 15 minutes. "Praetor 3-of-5 multisig + 48h timelock" → "Praetor multisig infrastructure deployed (single-key today on testnet; 3-of-5 Safe before mainnet)". Same for "5-invariant Kani+proptest target". Same for "3-keeper redundancy with economic slashing". These three rewrites turn the pitch surface from "advertised properties" into "shipped infrastructure + named gaps" — which institutional readers actually prefer.

4. **Patch `apps/verify/src/app/app/page.tsx:52-57` to fetch real status from `/api/deployments/status`.** 30 minutes. Removes the four "Source built · deploy Month 1 W2" stale rows and surfaces the real 30-contracts-deployed state. The aside is the first thing a returning user sees after onboarding.

5. **Mobile-app.html band-aid (Auditor B option C).** 2 hours. (a) always clear placeholders when the API returns missing data — kill the "leave the design placeholders if the API errors" comment in `mobile-app.html:1477-1481`; (b) `disabled` + honest-tooltip every dead button (`Open long · rTSLA-PERP`, `Move $50,000 USDC`, `Manage`, the 6 More-rows, the 4 "All ↗" / "New ↗" links); (c) replace fake hero `$12,374,820` SSR with a skeleton. **Until the React port lands (5-10 days), this is the only way a mobile user doesn't experience a clickable mockup.**

6. **Mobile-landing.html honesty pass.** 1 hour. (a) Pull the "live" pill off the Plinth mock card at line 961 → "design preview"; (b) wire impluvium dollar amounts (lines 901-932) to `/api/protocol/metrics` venue breakdown or zero them out; (c) replace the 10 `href="#"` footer links with real destinations matching the React footer; (d) SSR-render `—` for the hero `$12.37M` (line 893) so first paint is honest; (e) drop the fake "+ 41.2% · 30d" subtitle.

7. **Update sidebar wallet to `useAccount()` + add real nav for `/app/markets` and `/app/notifications`.** 1 hour. Auditor B H-2/H-3. Currently every logged-in user sees `0x1a3b…7f29` regardless of who they are; that's the worst class of UX lie.

8. **Add an `error.tsx` at the app root with the same wordmark treatment as `not-found.tsx`.** 30 minutes. Default Next.js 500 page on demo day is unsurvivable; branded 500 with "Something broke. Try refreshing, or check status at /lantern/sla." takes a half hour and saves a demo.

9. **Add the Voice + ✗ Don't section from `desing/Brand Kit.html:738-787` to the React `/brand` page.** 1 hour. The cultural asset that defines the team is currently only in the design prototype; surface it. Becomes a tool any contributor or judge can quote.

10. **Update the `transition-*` utility classes in `globals.css` to match the prototype tokens** (`color 0.12s`, `border 0.16s`, `card_lift 0.2s cubic-bezier(0.2, 0.7, 0.2, 1)`). 3-4 hours. Lifts the React app from "tailwind generic hover feel" to "prime brokerage smooth feel" across every component. Invisible per-page but compounds across the whole UI.

Subtotal: ~14 focused hours of polish work, of which item 1 is the single biggest perception lift.

---

## Hard truths

Three things to say out loud to the founder right now.

1. **The static landing-v2.html is currently lying to every desktop visitor.** No other audit framed it this bluntly: a `Math.random()` ticker labelled "Live testnet TVL" + 8 fake partner names + a $12.37M dashboard mock with a "live" pill on the front door is not "scope debt" or "still wiring" — it is the single failure mode the whole project's writing rules and honesty discipline were designed to prevent (`.claude/rules/writing.md`: "Every number on screen has a real source"; `CLAUDE.md` red lines: "Never invent a number"; CLAUDE.md: "Live dashboards never inflate"). The React app demonstrably knows how to ship honest pending states. The static landing was not held to the same bar. Until that bundle is replaced or rewired, every other piece of polish work is being done in service of a front door that betrays it. **Fix this first or the rest doesn't matter.**

2. **The mobile experience is currently worse than no mobile experience.** A clickable mockup that promises real wallet flows and then no-ops every button is more damaging than a "best viewed on desktop" splash — it advertises capability we don't have. A serious institutional client touching this on a phone walks away convinced Atrium is vapor, regardless of what `/app/*` does on their laptop. Auditor B's option-A port is 5-10 days; the option-C band-aid is 2 hours; the option to ship a clean "Atrium is desktop-first this quarter; mobile arrives Month X" splash is 30 minutes. **Any of the three is better than today's mockup.** Picking one is more urgent than picking which is best.

3. **The team's honesty discipline is genuinely institutional, and that's why the lies feel worse than at any other startup at this stage.** The manifesto says "Invent a number to look impressive in a deck" is something we will not do. The React layer enforces this with `honest-pending.test.ts`, `writing-banned-words.test.ts`, `apps/verify/tests/e2e/02-deposit-usdc.spec.ts:51-52` (which asserts the page body never contains the prototype placeholder numbers). The team built guardrails specifically against this failure. Then shipped a 1.6 MB bundle that bypasses every guardrail. The fix isn't about making the lies smaller; it's about making the guardrails reach the static surfaces. Extend `writing-banned-words.test.ts` (per Auditor E Tier-2 #11) to walk `*.html` and `*.ts` (currently `.tsx` only). Add a hash check that fails CI if `landing-v2.html` ships with `Math.random` or the partner names. Reach the front door with the same discipline that protects the React app. **The bar you've set for yourselves is the bar — meet it on every surface or lower it everywhere; mixed isn't institutional.**

---

*Net: ~14 focused hours of polish work + the architectural call on mobile would lift Atrium from "almost institutional" to "institutional". The React layer earned it; the static layer hands it back. The fix is small and the team knows how — they've already built every pattern this report asks for, just not on the surfaces a serious visitor sees first.*
