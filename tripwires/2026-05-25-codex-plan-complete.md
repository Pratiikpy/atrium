# Tripwire 2026-05-25: codex plan complete

> The codex plan (UI parity to the six provided mockup files) is done.
> Every BLOCKING item from the prior `2026-05-25-codex-plan-partial.md`
> tripwire is closed; every POLISH item is closed. Five answered the
> founder-decision Q1 to Q5 list by file content rather than ask.

## What landed in the second push (after partial)

| Commit | Item |
|---|---|
| e058bd2 | audit drift fixes: dark closing, centered nav, sidebar 248, landing initial-paint honesty, footer claim |
| 2903d9d | brand SVG assets (wordmark light + dark + app icon) + honest pending for raster |
| ff086b7 | impluvium catchment rebuild (BLOCKING #1 closed) + mobile-app responsive foundation (OLED tokens + MobileShell + iOS status bar + 5-tab glass bottom nav) |
| 76e2e0e | 5 mobile-app panels (Portfolio, Trade, Move, Agents, More) wired into /app/* routes (BLOCKING #2 closed) |
| c656f3b | subsystems vertical-stack + per-card grid; architecture 5-row stack with chips |

## Resolution of the five founder questions

| Q | Question | Answer |
|---|---|---|
| Q1 | Desktop landing canon parchment vs dark | **Parchment.** Confirmed by unpacking `desing/Atriumnew.html` via the new `scripts/unpack-figma-bundle.mjs`. The Figma-Make loading splash thumbnail is dark `#0E0E0F`, but the rendered CSS at `desing/extracted/Atriumnew/index.html:382` uses `--bg oklch(98.4% 0.004 85)` = `#FBFAF7` paper. Dark is only the embedded Sigil/closing slabs. Existing React landing matches. |
| Q2 | Mobile app surface: rebuild React responsive vs restore middleware rewrite | **Rebuild React responsive.** User said "always proper, never fastest". A new MobileShell renders at < md with the canon OLED dark chrome (status bar + wordmark + 5-tab glass bottom nav). Five panel components (Portfolio/Trade/Move/Agents/More) wired into the matching /app/* routes. Single React tree, one source of truth. |
| Q3 | Unpack the two Figma-Make bundles | **Done.** `scripts/unpack-figma-bundle.mjs` decodes the bundler manifest + base64-gzip assets + template. Both bundles now live at `desing/extracted/Atriumnew/index.html` and `desing/extracted/Atrium App.standalone/index.html` with full CSS + asset files. |
| Q4 | Mobile Preview.html references a Landing Page.html that was not provided | **Treated `Atriumnew.html` as the canonical desktop landing.** The names align: Atriumnew is the newer render, Landing Page is probably the older name. No seventh mockup found. |
| Q5 | Cohort partner sourcing for the 6 named logos | **Honest empty state, no partner logos rendered.** The mobile-landing already had this in place; the desktop cohort-section also degrades to empty when Scribe returns no partners. The 6 names from the canon (Pendle / Variational / Horizen / IOSG / Hyperliquid / Aave Labs) are intentionally NOT shipped until signed LOIs land. |

## Final codex plan status

| Item | Status |
|---|---|
| E.1 BRAND palette canon | Done (commit 421b4eb) + class-name sweep (b7074d7) |
| E.2 BRAND missing sections | Done + asset SVGs (2903d9d) |
| E.3 DESK-LAND impluvium catchment | Done (ff086b7) |
| E.3 DESK-LAND closing dark | Done (e058bd2) |
| E.3 DESK-LAND header centered | Done (e058bd2) |
| E.3 DESK-LAND footer honesty | Done (e058bd2) |
| E.3 DESK-LAND subsystems density | Done (c656f3b) |
| E.3 DESK-LAND architecture density | Done (c656f3b) |
| E.4 shell polish | Done (sidebar 248, accent gradient, nav badge dropped, bell icon, commits 421b4eb + e058bd2 + ff086b7) |
| E.5 MOB-APP foundation | Done (OLED tokens + MobileShell + status bar + 5-tab nav, ff086b7) |
| E.5 MOB-APP 5 panels | Done (Portfolio/Trade/Move/Agents/More with live data, 76e2e0e) |
| E.6 mobile-landing data wiring | Done (commits 421b4eb + e058bd2) |

## Verification matrix (final)

| Check | Status |
|---|---|
| pnpm next build | green |
| pnpm vitest run | 589 of 589 pass |
| pnpm tsc | 3 pre-existing latent errors (#361 ESLint backlog), no new errors from codex work |
| Brand canon palette through entire app | every component uses canon tokens |
| Mobile UA at /app/portfolio | renders OLED dark MobileShell with PortfolioMobile (hero buying-power card + 4-action grid + positions + activity) |
| Desktop UA at / | parchment landing with canon impluvium catchment + canon dark closing slab + dense subsystems + dense architecture |
| Brand kit /brand | all 7 Roman-numbered sections render to canon |
| Honesty: no hardcoded $ values flash on first paint | mobile-landing + desktop landing both clean |

## Remaining items (separate from codex plan)

These are NOT codex items; they belong to other plans or human ops:

- #353 Phase beta.5 timelock execute at 2026-05-26T15:43Z (~24h)
- #342 3-of-5 Safe migration (founder ceremony)
- #361 ESLint flat-config migration (deferred per launch tripwire)
- Brand asset raster PNGs + ICO (need ImageMagick/Inkscape; SVGs shipped)
- Deployer EOA rotation (2026-05-24 incident, on file in human_left.md)
- Vercel env updates for Lantern + Chaos + verify mirror (founder action)
- Graph Studio subgraph v0.0.6 re-deploy (founder has the deploy key)

## Git artefact

Commits since the prior partial-tripwire (1d33b0e):
```
b7074d7  refactor(ui): class-name sweep
e058bd2  fix(ui): codex audit drift
2903d9d  feat(brand): canonical SVG assets
ff086b7  feat(ui): mobile-app foundation + impluvium catchment
76e2e0e  feat(ui): 5 mobile-app panels
c656f3b  fix(ui): subsystems + architecture density
```

Tag-worthy. Founder to push and `git tag v0.1.1-ui-canon` when ready.
