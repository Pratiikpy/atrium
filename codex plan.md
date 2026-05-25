# codex plan: UI parity to provided mockups

Version 0.1 . Last updated 2026-05-25 . Author: tech cofounder

## Scope

Implement the Atrium product UI exactly from the six provided HTML mockup files. Treat the mockups as the final visual contract. No redesign, no simplification, no reinterpretation, no "make something similar". Visual drift counts as a defect. Mock data shown as real counts as a defect. Half built screens behind dead buttons count as a defect.

This plan is read in three passes:

1. Provided Mockup Inventory (what is in the six files, what they target)
2. Mockup to Implementation Matching (which mockup maps to which React route, what is shipped, what is missing)
3. Final Provided Design Verification Report (the checklist a reviewer can run after the work lands)

The audit that produced this plan was a read only sweep of all six files plus the React routes in `apps/verify/src/app/`.

---

## A. Provided Mockup Inventory

Six files were provided at `C:\Users\prate\Downloads\arb builder\desing\`.

| # | File | Bytes | Lines | Purpose | Bucket | Bundle type |
|---|---|---|---|---|---|---|
| 1 | `Atrium App.standalone.html` | 1,621,715 | 186 | Authenticated desktop app shell (sidebar nav, parchment) | Desktop product | Figma-Make bundler (opaque) |
| 2 | `Mobile App.html` | 57,140 | 1,425 | Native mobile app shell, OLED dark, 5-tab bottom bar | Mobile product | Plain HTML+CSS+JS |
| 3 | `Mobile Landing.html` | 43,095 | 1,197 | Mobile marketing landing, OLED dark | Mobile landing | Plain HTML+CSS+JS |
| 4 | `Mobile Preview.html` | 14,673 | 437 | Designer review surface (3 iPhone frames as iframes) | Designer chrome (meta) | Plain HTML+CSS+JS |
| 5 | `Atriumnew.html` | 1,624,185 | 179 | Probable desktop landing, dark canvas, italic wordmark hero | Desktop landing | Figma-Make bundler (opaque) |
| 6 | `Brand Kit.html` | 36,912 | 878 | Logo, type, palette, components, voice, trademark | Brand canon | Plain HTML+CSS+JS |

Total: 4,302 lines of plain markup plus two opaque Figma-Make bundles.

### Notes per file

**(1) Atrium App.standalone.html.** The visible HTML is 96 lines of bootstrapper plus three `<script type="__bundler/...">` blocks holding base64-gzip-encoded React. Only the noscript SVG thumbnail (lines 23 to 34) is statically parseable: parchment `#FBFAF7` body, soft parchment `#F5F2EC` sidebar at 240px, ink `#1A1714`, three stacked cards on the right. The full per page layout cannot be read without running the bundler.

**(2) Mobile App.html.** Fully parseable. Five panels: Home, Trade, Move, Agents, More. iPhone 360x760 frame, border radius 52px. CSS variables at lines 14 to 28: `--bg oklch(8% 0.006 60)` (near black), `--bg-card oklch(14% 0.006 60)`, `--ink oklch(97% 0.004 85)`, `--accent oklch(72% 0.14 28)`, `--testnet oklch(78% 0.14 70)` amber, `--live oklch(72% 0.15 145)` green, `--neg oklch(66% 0.18 28)` red. Fonts: Instrument Serif italic for the wordmark, Geist for body, Geist Mono for figures. Status bar with 9:41 + signal + wifi + battery SVGs. Bottom tab bar with `backdrop-filter: blur(20px)`.

**(3) Mobile Landing.html.** Same OLED dark palette as Mobile App. Section order: status bar, floating top nav with scroll state, hero with grid background and radial glow ("One wallet. Every venue. One buying-power number."), Impluvium fig.01 card with pool + 6 venue chips, Product / Plinth, Aqueduct (CCIP), Sigil (agents terminal), Stats band (TVL, agents, queries, venues), Subsystems mini grid (8 cards), Cohort trust strip, CTA band, Footer.

**(4) Mobile Preview.html.** A meta page that frames `Landing Page.html`, `Atrium App.html`, `Brand Kit.html` inside three iPhone frames via `<iframe>`. Important: it references a file `Landing Page.html` that is NOT in the provided six. Likely `Atriumnew.html` is the same surface under a different name, but this is an open question (see Open Questions below).

**(5) Atriumnew.html.** Same Figma-Make bundler shape as file 1. Thumbnail tokens: background `#0E0E0F` (OLED dark), wordmark `#F5F2EC` parchment as ink on dark, accent `#CC8E2D` amber. If this file is the canonical desktop landing, the current React parchment landing is the wrong color.

**(6) Brand Kit.html.** Fully parseable. Seven roman numbered sections (I Logo, II Typography, III Colour, IV Components, V Voice, VI Trademark and usage, VII Download). Palette in OKLCH plus hex (lines 587 to 674): paper `#FBFAF7`, ink `#1A1714`, accent oxblood `#7E2A20`, live moss `#43864F`, testnet amber `#CC8E2D`, neg clay `#A1352A`, line `#DBD8D2`, muted `#807872`. App icon spec: italic A on `#1A1714` tile with breathing amber / green / red status bar.

---

## B. Mockup to Implementation Matching

Existing implementation lives under `apps/verify/src/`.

| Mockup | Target route (final) | Current implementation file | Status |
|---|---|---|---|
| Atrium App.standalone.html | `/app/*` (desktop) | `apps/verify/src/components/app-shell.tsx` + 13 `apps/verify/src/app/app/*/page.tsx` routes | Polish gaps + per page parity unverifiable until bundle unpacked |
| Mobile App.html | `/app/*` on mobile UA, OR `/mobile/app` | `apps/verify/public/mobile-app.html` (static preview only); React `/app/*` is desktop chrome shrunk | BLOCKING: mobile UA gets the wrong surface |
| Mobile Landing.html | `/` on mobile UA | `apps/verify/public/mobile-landing.html` served via `middleware.ts:41` rewrite | Shipped; two data sourcing nits |
| Mobile Preview.html | (none) | (none) | n/a, designer chrome |
| Atriumnew.html | `/` on desktop UA | `apps/verify/src/app/page.tsx` (parchment, 11 sections) | BLOCKING IF dark canvas is canon, otherwise OK |
| Brand Kit.html | `/brand` | `apps/verify/src/app/brand/page.tsx` | BLOCKING: parallel palette + three missing sections |

### B.1 Audit per mockup

For each file: section list extracted from the markup, parity against the current React route, and the gap.

**(1) Atrium App.standalone.html  →  React `/app/*`**

What ships in `app-shell.tsx`:

- Sidebar 220 px wide, parchment background, italic serif Atrium wordmark, testnet pill, Search input.
- Grouped nav with TRADE, AGENTS, TRUST, ACCOUNT section headings.
- Active state filled ink background, wallet card pinned to bottom.
- `md:hidden` horizontal nav strip for narrow viewports.

Gaps:

- Sidebar width is 220 px in code, ~240 px in the prototype thumbnail.
- Wallet card uses `from-terracotta to-ink-soft` gradient (`app-shell-wallet-card.tsx:37`). Per Brand Kit canon there is no terracotta; the accent is oxblood and is one token.
- Static `'0'` badge on the Agents nav item is wrong. Per `.claude/rules/ui.md`, badges show real counts or do not render.
- Per page layouts (Portfolio stat row, Margin Engine bar chart, Buying Power sparkline, Positions table on `/app/portfolio`) cannot be visually verified because the prototype file is a Figma-Make bundle. Comments in code claim parity but no reviewer can confirm.

Fix track: see Section E, work item DESK-APP.

**(2) Mobile App.html  →  React `/app/*` on mobile UA**

What ships:

- Static HTML preview at `/mobile/app` (`public/mobile-app.html`) that mirrors the mockup closely, with live wiring to `/api/portfolio/buying-power` and `/api/portfolio/positions` (honest empty states on fetch fail).
- React `/app/*` tree is parchment light, with a top horizontal scroll strip on narrow viewports.

Gaps:

- A real mobile UA hitting `/app/portfolio` gets the desktop chrome shrunk, not the OLED dark mobile app. Per `middleware.ts:49` Path B, the mobile UA rewrite for `/app/*` was dropped. So the dedicated mobile app never auto serves.
- Tab labels differ: mockup has Home / Trade / Move / Agents / More in a 5-tab bottom glass bar. React nav has 9+ items in a top strip.
- No iOS status bar, no `backdrop-filter: blur(20px)` bottom bar, no OLED dark theme in the React tree.
- Mandate banner (`delphi.eth $12,418 / $50,000 . 5d left`) styling missing on `/app/agents`.

Fix track: see Section E, work item MOB-APP. Founder decision needed first: rebuild in React or restore the static rewrite.

**(3) Mobile Landing.html  →  React `/` on mobile UA**

What ships:

- `public/mobile-landing.html` (1,245 lines vs the mockup's 1,197; the extra ~30 lines are a bootloader that calls `fetch('/api/protocol/metrics')` and overwrites `.pool .v`, stats grid cells, etc.).
- All sections present in correct order.
- Live data path: honest fallback to `$0` or `0` on miss.

Gaps:

- Six venue chips at lines 901 to 933 ship hardcoded amounts (`$1.25M`, `$892K`, etc.) that flash before the JS overwrites. Wire to `/api/protocol/metrics` or render an em dash.
- Cohort logos strip at lines 1118 to 1124 (Pendle, Variational, Horizen, IOSG, Hyperliquid, Aave Labs) is not overwritten by any fetch. Per `.claude/rules/writing.md` claims discipline, partner names ship only if a real partner list source is committed; otherwise remove.

Fix track: see Section E, work item MOB-LAND.

**(4) Mobile Preview.html  →  (no route)**

Nothing to ship. This is a designer review surface. Action: leave alone, but answer Open Question Q1 so it does not keep referencing a missing `Landing Page.html`.

**(5) Atriumnew.html  →  React `/` on desktop UA**

What ships in `apps/verify/src/app/page.tsx`:

- Eleven sections in the order: LandingHeader, HeroSection, ProductSection, PlinthSection, AqueductSection, SigilSection, LanternSection, NumbersSection, SubsystemsSection, ArchitectureSection, CohortSection, ClosingSection, LandingFooter.
- Canvas is `bg-parchment`.

Gap:

- The Atriumnew thumbnail shows a dark `#0E0E0F` canvas with parchment `#F5F2EC` ink wordmark and amber `#CC8E2D` accent. The current React landing is the inverse. If Atriumnew is canonical, the whole landing palette is wrong.
- Per page contents cannot be verified until the bundle is unpacked.

Fix track: see Section E, work item DESK-LAND. Blocked on Open Question Q1.

**(6) Brand Kit.html  →  React `/brand`**

What ships in `apps/verify/src/app/brand/page.tsx`:

- Wordmark sizes (hero, lg, md, sm). Palette section with 13 swatches. Typography specimens. Buttons. Cards. Status pills.

Gaps:

- Palette divergence. React uses `terracotta #B5523F`, `success #2D6A4F`, `warning #B8860B`, `danger #C04A39`. Brand Kit canon is `accent oxblood #7E2A20`, `live moss #43864F`, `testnet amber #CC8E2D`, `neg clay #A1352A`. Four colors, all wrong. This is a parallel design system. Per `.claude/rules/ui.md`: "Do not invent a parallel system." Hard rule violation.
- Missing: app icon gallery at 160 / 64 / 32 / 16 sizes with italic A on `#1A1714` tile and breathing amber / green / red status bar (the live favicon idea from CLAUDE.md).
- Missing: construction spec card (tracking `-0.014em`, optical correction, min size 14 px digital / 8 pt print, app icon 64x64 grid 14 px corner radius).
- Missing: Section V Voice ("We are: Precise. Restrained. Architectural. Quietly confident." vs "We are not: Hyped. Memed. Decorative.").
- Missing: Section VI Trademark and usage (You may / You may not lists).
- Missing: Section VII Download (SVG, PNG, ICO asset links).
- Component drift: buttons are square corners in React (`rounded-md`); Brand Kit says pill 38 px (`border-radius: 999px`).
- Missing: Numerals specimen card (`$12,378,422`, `+ 14.82% . 7d P&L`, `0x4f29...81e0 . block #8,142,317` using Geist Mono tabular).

Fix track: see Section E, work item BRAND.

---

## C. Strict do not rules (restated)

These apply to every line of code that lands under this plan.

- Do not redesign a section. The mockup is the design.
- Do not simplify a layout. The density is the product.
- Do not swap fonts. Instrument Serif italic for the wordmark, Geist for body, Geist Mono for figures and addresses.
- Do not add a color that is not in the Brand Kit palette.
- Do not invent a parallel system. No second design tokens file. No two button shapes.
- Do not ship the prototype numbers as truth. `$4.20M TVL`, `37 agents`, `42,392 queries`, eight named partners are placeholders unless backed by Scribe, RPC, a tx hash, or a signed source.
- Do not fill gaps with impressive looking numbers. Show `0`, `pending`, `not indexed yet`, or a named empty state.
- Do not replace prototype components with generic shadcn blocks. Use shadcn only as an implementation base after restyling.
- Do not skip mobile, empty, loading, error, or permission states for any feature.
- Do not ship a dead button or a half wired CTA.
- Do not silently change scope. If a mockup element cannot be wired yet, keep the exact UI shape and render an honest pending / empty / disabled state with the real missing dependency named.

---

## D. Open questions (founder action required)

Before any code lands, answer these. They block the plan.

**Q1. Desktop landing canon.** Is the canonical desktop landing the parchment light surface (current React `/`, matches `desing/extracted/full-render-tokens.json`) or the dark `#0E0E0F` surface (Atriumnew.html thumbnail)? Need a single answer. If dark, the entire landing rebuilds.

**Q2. Mobile app surface.** For a mobile UA at `/app/portfolio`, which surface is correct: (a) rebuild React `/app/*` responsive at `< 720 px` with OLED dark + 5-tab bottom bar + iOS status bar, OR (b) restore the middleware rewrite so mobile UA hits the static `public/mobile-app.html`? Option (a) is more correct but more work. Option (b) ships the mockup exactly but means two parallel app implementations.

**Q3. Figma-Make bundles.** Files 1 and 5 are opaque to static audit. Can you unpack them (open in a browser, save the rendered HTML or screenshot every page) and commit the unpacked versions under `desing/extracted/`? Without this, no reviewer can verify per page parity, and we are inferring intent from a 1.5 MB blob.

**Q4. Mobile Preview.html reference to `Landing Page.html`.** The iframe at line 360 of Mobile Preview references a file `Landing Page.html` that was not provided. Is `Atriumnew.html` the same file under a different name, or is there a seventh mockup we have not seen?

**Q5. Cohort partner sourcing.** The Mobile Landing strip names Pendle, Variational, Horizen, IOSG, Hyperliquid, Aave Labs. Per `.claude/rules/writing.md` claims discipline, partner names ship only with a real source. Do we have signed cohort confirmations on file (and where), or do we render placeholder slots until they sign?

---

## E. Implementation plan (after Q1 and Q2 are answered)

Sequenced linearly. Each work item lists files touched, scope in LOC, and the verification step.

### E.1  BRAND palette reconciliation (do first; cascades everywhere)

**Why first.** Every other work item references a color. Fixing the palette once at the token layer means downstream work uses the right colors automatically.

**Files:**
- `apps/verify/src/app/globals.css` (or wherever the Tailwind theme extends): replace `terracotta`, `success`, `warning`, `danger` with `accent` (`#7E2A20` / `oklch(48% 0.13 28)`), `live` (`#43864F`), `testnet` (`#CC8E2D`), `neg` (`#A1352A`). Keep the legacy class names as aliases for one merge cycle, then delete.
- `tailwind.config.ts`: same edit at the theme layer.
- Grep and replace `bg-terracotta`, `text-terracotta`, `border-terracotta` to `bg-accent`, etc. (Estimate: ~80 to ~150 occurrences across the app.)
- `apps/verify/src/app/brand/page.tsx`: rewrite the palette section to render the eight Brand Kit swatches with OKLCH + hex captions exactly as `desing/Brand Kit.html:587-674`.

**Scope:** ~200 LOC of edits, mostly mechanical class renames.

**Verification:** Visual diff `/brand` page side by side with `desing/Brand Kit.html`. Every swatch tile matches OKLCH + hex.

### E.2  BRAND missing sections

**Files:**
- `apps/verify/src/app/brand/page.tsx`: add four sections, copying markup + styles from `desing/Brand Kit.html`:
  - App icon gallery (lines 360 to 457): 160 / 64 / 32 / 16 sizes, italic A on `#1A1714` tile with breathing amber / green / red status bar.
  - Construction spec card (lines 461 to 500): tracking `-0.014em`, optical correction, min size, app icon 64x64 grid 14 px corner radius.
  - Section V Voice (lines 738 to 787): Do / Don't card pair.
  - Section VI Trademark and usage (lines 789 to 826): You may / You may not lists.
  - Section VII Download (lines 828 to 867): SVG, PNG, ICO links pointing at `apps/verify/public/brand/*` assets.
- Button restyle: switch from `rounded-md` to `rounded-full` with `h-[38px]` to match Brand Kit pill spec.
- Add Numerals specimen card (Brand Kit lines 713 to 720) using Geist Mono tabular.

**Scope:** ~300 LOC + asset files (SVG wordmark light + dark, PNG 160 / 64 / 32, ICO favicon).

**Verification:** All seven Brand Kit sections present at `/brand` in the same order as `desing/Brand Kit.html`. Click each Download link, receive a real file.

### E.3  DESK-LAND  (blocked on Q1)

If Q1 = parchment canon: minor reconciliation only. Run a side by side against any unpacked render of Atriumnew.html and fix per section drift. Estimate ~6 hours.

If Q1 = dark canon (Atriumnew is the truth): rebuild the entire landing on the OLED dark palette. Files touched: every component under `apps/verify/src/components/landing/*` and `apps/verify/src/app/page.tsx`. Estimate ~24 hours. Tripwire on the day the decision lands.

**Verification:** Compare `/` on desktop UA at 1440 px viewport against the canonical rendering, section by section. Section order, color, type, spacing, radii, shadows all match.

### E.4  DESK-APP polish (per page parity blocked on Q3)

**Shell level edits (can land now):**
- `app-shell.tsx`: widen sidebar `w-[220px]` to `w-[240px]`.
- `app-shell-wallet-card.tsx`: replace `from-terracotta to-ink-soft` gradient with the canonical `accent` token.
- Drop the static `'0'` Agents nav badge.

**Scope:** ~30 LOC.

**Per page parity (blocked on Q3, the bundle unpack):**
- Once `desing/extracted/atrium-app-standalone-portfolio.html`, `...-trade.html`, etc. are committed, walk each of the 13 `apps/verify/src/app/app/*/page.tsx` routes against its prototype counterpart and fix drift. Estimate ~16 hours after the bundle is unpacked.

**Verification:** Side by side `/app/portfolio`, `/app/trade`, `/app/transfer`, `/app/agents`, `/app/reserves`, `/app/tax`, `/app/settings`, `/app/markets`, `/app/notifications`, `/app/vault`, plus `/lantern`, `/security` against the unpacked Atrium App standalone files.

### E.5  MOB-APP  (blocked on Q2)

If Q2 = (b) restore static rewrite: ~30 LOC change in `apps/verify/src/middleware.ts` to rewrite `/app/*` to `/mobile-app.html` when UA matches a mobile pattern. Plus a sanity pass on `public/mobile-app.html` to keep the live data wiring working through the rewrite. Estimate ~2 hours.

If Q2 = (a) rebuild in React: a new responsive layer in `app-shell.tsx` that activates at `< 720 px` viewport and switches to OLED dark, renders the iOS status bar, and replaces the top nav strip with a 5-tab bottom glass bar. Each of the 13 app pages gets a mobile branch that mirrors the corresponding Mobile App.html panel. Estimate ~30 hours.

**Verification:** Open `/app/portfolio` on a real mobile UA (or Chrome devtools iPhone 12 emulation). Expect OLED dark canvas, 5-tab bottom glass bar (Home / Trade / Move / Agents / More), iOS status bar, hero buying power card, positions list.

### E.6  MOB-LAND data sourcing

**Files:**
- `apps/verify/public/mobile-landing.html`: replace the hardcoded venue chip amounts (lines 901 to 933) with placeholder values + a class hook (`.venue-chip-amount[data-venue="hl-hip3"]`) the bootloader script overwrites from `/api/protocol/metrics`.
- Bootloader script (lines 1207 to 1244): extend the fetch handler to overwrite the six venue chip amounts. Honest fallback to em dash on miss.
- Cohort logos (lines 1118 to 1124): either wire to a real partner list source (see Q5) or remove the row entirely. Do not ship placeholder names.

**Scope:** ~40 LOC.

**Verification:** Load `/` on mobile UA. Disconnect network. All numbers and partner names render as em dash or empty, not as fake amounts.

### E.7  MOBILE PREVIEW reconciliation

Nothing to ship. Once Q4 is answered, optionally fix the broken iframe references in `desing/Mobile Preview.html` so the designer review surface works.

---

## F. Sequencing

Linear, single branch.

1. Answer Q1 to Q5 (founder, before any code).
2. Unpack the two Figma-Make bundles to `desing/extracted/` (Q3 unblocker).
3. E.1 BRAND palette reconciliation (cascades everywhere).
4. E.2 BRAND missing sections.
5. E.4 shell level edits (sidebar width, wallet gradient, nav badge).
6. E.6 MOB-LAND data sourcing.
7. E.5 MOB-APP (after Q2 answered).
8. E.3 DESK-LAND (after Q1 answered).
9. E.4 per page parity (after Q3 unblocked).
10. Final Provided Design Verification Report (Section G below) executed end to end.

---

## G. Final provided design verification report (post implementation checklist)

Run this checklist after every work item lands. Every line is pass or fail. No "mostly" answers.

### G.1 Files reviewed

- [ ] All six provided HTML files opened and read.
- [ ] Both Figma-Make bundles unpacked to `desing/extracted/`.
- [ ] Brand Kit OKLCH + hex palette extracted to `apps/verify/src/app/globals.css` token layer.
- [ ] Section list per mockup committed to this plan file.

### G.2 View types verified

- [ ] Desktop landing  →  `/` on desktop UA: matches `desing/Atriumnew.html` (canvas color, section order, type, spacing, accent).
- [ ] Desktop app  →  `/app/portfolio` plus 12 sibling routes: each route matches its unpacked counterpart from `desing/Atrium App.standalone.html`.
- [ ] Mobile landing  →  `/` on mobile UA: matches `desing/Mobile Landing.html` (OLED dark, hero, Impluvium card, all sections in order).
- [ ] Mobile app  →  `/app/portfolio` on mobile UA: matches `desing/Mobile App.html` (OLED dark, 5-tab bottom bar, iOS status bar) OR static rewrite to `/mobile-app.html` is in place and serves the mockup byte for byte.
- [ ] Brand kit  →  `/brand`: matches all seven sections of `desing/Brand Kit.html` (Logo, Typography, Colour, Components, Voice, Trademark, Download).

### G.3 Visual details verified

- [ ] Color tokens: paper `#FBFAF7`, ink `#1A1714`, accent oxblood `#7E2A20`, live moss `#43864F`, testnet amber `#CC8E2D`, neg clay `#A1352A`, line `#DBD8D2`, muted `#807872`. No tokens outside this set.
- [ ] Dark canvas: `#0E0E0F` for any dark surface (mobile, dark landing if applicable).
- [ ] Fonts: Instrument Serif italic wordmark, Geist body, Geist Mono figures and addresses. No other faces.
- [ ] Typography scale: Display 64/67, Section 40/44, Title 22/29, Body 17/26, Figures Geist Mono 14/22, Caps 10.5 with 0.14 em tracking, Wordmark 56 italic.
- [ ] Radii: 6, 10, 12, 14, 16, pill 999.
- [ ] Buttons: pill 38 px height, `border-radius: 999px`. No `rounded-md` square corners on any CTA.
- [ ] Card shadows: subtle layered, not glossy.
- [ ] Motion: 120 to 200 ms for fast color and transform changes, `cubic-bezier(0.2, 0.7, 0.2, 1)` for card lift, ~400 ms for opacity.
- [ ] Mobile bottom tab bar: `backdrop-filter: blur(20px)`, 5 columns, Home / Trade / Move / Agents / More.
- [ ] Live favicon: black `#1A1714` tile, italic A, breathing status bar in amber / green / red driven by testnet health.

### G.4 Data discipline verified

- [ ] No screen renders `$4.20M TVL`, `37 agents`, `42,392 queries`, `$12.3M wallet`, `7/8 venues live`, or any other prototype placeholder as if it were real.
- [ ] Every visible number traces to Scribe, an RPC read, a tx hash, or a signed source. Numbers in flight render as a skeleton with the source name ("from Scribe", "from RPC"). Numbers unavailable render as `0`, em dash, or a named empty state.
- [ ] No partner / cohort logo ships without a committed source. Aspirational logos are removed, not faded.
- [ ] Faucet CTA promises (amounts, cooldowns) match the deployed faucet contract.

### G.5 States verified per feature

For each route built under this plan:

- [ ] Empty state present (no data yet, named).
- [ ] Loading state present (skeleton, not spinner).
- [ ] Error state present (named cause, retry action).
- [ ] Permission state present (wrong wallet, wrong tier, paused contract).
- [ ] Success state present (clear confirmation, link to Arbiscan tx where applicable).
- [ ] Mobile layout present (touch targets >= 44 px, no horizontal scroll).

### G.6 Honesty patterns verified

- [ ] Aave Horizon adapter on Sepolia is disclosed as running against an Atrium-deployed MockAavePool (`security/page.tsx`).
- [ ] Pyth equity feeds disclosed as running on a Praetor signed relay until native Sepolia.
- [ ] Vigil keeper count renders as the live `Vigil.active_keeper_count()` value (or `0` and the unblock note from `human_left.md`).
- [ ] Year-1 validator set disclosed as 1-of-1 with the Safe migration timeline.

### G.7 Accessibility and performance verified

- [ ] WCAG AA contrast on the primary palette (`accent` on paper, `ink` on paper, white on `accent`, etc.).
- [ ] Every interactive element has a focus ring.
- [ ] Every icon has a label (visible or aria).
- [ ] Keyboard navigation works without a mouse on `/`, `/app/*`, `/brand`, `/verify/*`.
- [ ] Mobile Lighthouse >= 90 (perf, a11y, best practices, SEO).
- [ ] No client bundle larger than 250 KB gzipped on `/`.
- [ ] Wallet libraries deferred until the user clicks Connect.

### G.8 Final go / no go

Plan ships only when every line in G.1 through G.7 is a pass. One fail is one block. Surface the fails out loud; do not paper over.

---

## H. Tripwire commitment

If any of the following happens during execution, raise it the same day with the format from `.claude/rules/writing.md`:

- Q1 answer arrives late and DESK-LAND slips past the 2026-05-27T19:30Z timelock window.
- Per page parity work on `/app/*` runs longer than 16 hours after the bundle is unpacked.
- A mockup element turns out to require a dependency that does not exist (e.g., a real cohort partner list source).
- Any color outside the Brand Kit canon gets requested or proposed.

Cuts are announced same day. Quiet drift is the failure mode.

---

## I. References

- Mockups: `desing/Atrium App.standalone.html`, `desing/Mobile App.html`, `desing/Mobile Landing.html`, `desing/Mobile Preview.html`, `desing/Atriumnew.html`, `desing/Brand Kit.html`.
- Token extracts: `desing/extracted/tokens.json`, `desing/extracted/full-render-tokens.json`.
- Standing rules: `.claude/rules/ui.md`, `.claude/rules/writing.md`, `CLAUDE.md` (Prototype UI contract section).
- Current implementation index: `apps/verify/src/app/*` and `apps/verify/src/components/*`.
- Prior phase tripwire: `tripwires/2026-05-25-phase-zeta-complete.md`.
