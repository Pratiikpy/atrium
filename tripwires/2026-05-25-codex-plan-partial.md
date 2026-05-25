# Tripwire 2026-05-25: codex plan partial

> The codex plan (UI parity to the six provided mockups) is partially
> executed. Four work items shipped in commit 421b4eb. Three more are
> founder-blocked on five decisions in `codex plan.md` Section D. This
> tripwire announces what landed, what is waiting, and what changes
> if any of the five answers come back negative.

## What shipped (commit 421b4eb, 2026-05-25)

| Codex item | Status | Notes |
|---|---|---|
| E.1 BRAND palette canon | Done | Tokens added + legacy aliases. Two real visual bugs fixed (danger + status-red previously rendering as oxblood instead of clay). |
| E.2 BRAND missing sections | Done | App icon gallery, construction spec, voice, trademark, download, numerals, button pill restyle. |
| E.4 shell polish (partial) | Done | Sidebar 220 to 240, dropped static '0' Agents badge, wallet card terracotta var swapped for accent, latent bell-icon bug fixed. |
| E.6 mobile-landing wiring (partial) | Done | Bootloader field names corrected (every fetch was hitting catch); venue chip deployment hydration; HL-HIP3 flipped to pending. |
| ζ.5 chaos test debt | Done | 11 failing tests become 15 passing; verify-app vitest 589 of 589 green. |

## What is waiting on founder decisions

Five blockers in `codex plan.md` Section D. Until they land, the rest
of the plan stays frozen because every downstream item depends on a
direction the founder owns:

| ID | Decision | Blocks |
|---|---|---|
| Q1 | Desktop landing canon: parchment (current React) or dark `#0E0E0F` (Atriumnew.html thumbnail)? | E.3 DESK-LAND (24+ h rebuild if dark wins) |
| Q2 | Mobile app surface: rebuild React `/app/*` responsive at < 720 px OR restore the middleware UA rewrite to `mobile-app.html`? | E.5 MOB-APP (30 h vs 2 h) |
| Q3 | Unpack the two Figma-Make bundles (`Atrium App.standalone.html`, `Atriumnew.html`) to `desing/extracted/` so static audit is possible? | E.4 per-page parity, E.3 verification |
| Q4 | `Mobile Preview.html` references a `Landing Page.html` that was not provided. Is `Atriumnew.html` the same file renamed, or is there a seventh mockup? | Q1 disambiguation |
| Q5 | Cohort partner list: do we have signed confirmations for Pendle / Variational / Horizen / IOSG / Hyperliquid / Aave Labs, or render placeholder slots? | E.6 cohort logos on `mobile-landing.html` |

## Score projection

- 2026-05-25 pre-codex: 6 of 6 codex items unaddressed, palette canon
  drift in shipped UI, mobile-landing always rendered $0 on fetch.
- 2026-05-25 post-codex (this push): 4 of 6 unblocked items shipped,
  palette drift fixed at the token layer, mobile-landing real data
  path works, 11 silent test failures cleaned.
- 2026-05-25 founder-decisions-pending: 3 of 6 items blocked on Q1
  through Q5. Estimated unblock work after answers land: ~6 h to ~32 h
  depending on which way Q1 + Q2 go.

## Open follow-ups (non-blocking, can land any time)

- Class-name sweep: 116 occurrences of `bg-terracotta` / `bg-success`
  / `bg-warning` / `bg-danger` across 41 files. Mechanical rename to
  `bg-accent` / `bg-live` / `bg-testnet` / `bg-neg`. Aliases keep
  visuals identical either way; rename is for canon naming clarity.
  Separate commit once an extended block of testing time is available
  (low risk, but wide diff).
- Brand asset files at `apps/verify/public/brand/assets/` are linked
  from the new Download section but do not exist yet. SVG wordmark
  (light + dark), PNG 2x / 4x, app icon SVG, apple-touch-icon 180x180,
  android 192 / 512. Founder ships the SVGs; PNG and ICO can be
  generated from them.
- Mobile landing cohort logos row stays placeholder until Q5 lands.

## Git artefact

This push is one commit: `421b4eb feat(ui): codex plan partial -
brand canon, shell polish, mobile-landing wiring`. Not yet pushed to
origin; founder runs `git push origin master` when ready.
