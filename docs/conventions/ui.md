# UI rules

## Design source of truth

The visual language lives in `design/`. Two HTML files:

- `design/Atrium.html`
- `design/Atrium App.standalone.html`

Before any UI work:

1. Open both HTML files.
2. Read the markup, not just the rendered view. Extract the design tokens (colors, font stacks, spacing, radii, shadows).
3. Note the logo treatment, hero rhythm, card style, button states, micro interactions.
4. Match. Do not invent a parallel system.

Never blindly clone an existing screen unless the task is that exact screen. Use the system, not the page.

## Tokens to extract from `design/`

- Primary palette (parchment, terracotta accent, navy ground per the Atrium brand language)
- Typography stack and scale (display, body, micro)
- Spacing scale (4, 8, 12, 16, 24, 32, 48)
- Radii (sm, md, lg) and shadow style
- Button states (default, hover, focus, disabled, loading)
- Card style (border, shadow, padding, internal rhythm)
- Form input style (height, focus ring, error state)
- Code or data block style (monospace, background)

If a token is missing from the HTML files, raise it. Do not pick a number out of thin air.

## Stack

- Next.js 15 (App Router) on Vercel free tier
- Tailwind v4
- shadcn/ui base components, themed to match `design/`
- Wagmi + Viem for chain reads and writes
- TanStack Query for caching reads
- next-pwa for the mobile path (Lighthouse ≥ 90)

Stack decisions are recorded in `TECH_DESIGN.md` §12. Do not swap without an ADR.

## Required states for every feature

- Empty state (no data yet)
- Loading state (skeleton, not spinner)
- Error state (named cause, action to retry)
- Permission state (wrong wallet, wrong tier, paused contract)
- Success state (clear confirmation, link to tx)
- Mobile layout (touch targets ≥ 44px, no horizontal scroll)

A feature without these is not done. Surface what is missing instead of hiding it.

## Live data discipline

- Numbers shown on screen come from Scribe or a live RPC read. Never from a config file.
- If a number is in flight, show a skeleton with the source name (`from Scribe`, `from RPC`).
- If a number is unavailable, show the reason and a refresh action.
- Never display a placeholder number that looks real.

## Verifier Mode rules (the judge facing surface)

`verify.useatrium.me` is the demo surface. Per PRD §26.1.

- Each step renders a single primary action.
- After each step, surface the resulting tx hash with an Arbiscan link.
- Show the Kani CI badge top right.
- Chaos Mode button injects a random fault. The UI must show graceful degradation messages, not a crash.
- Kill Switch button revokes all Sigil mandates and Postern session keys in one batched tx. Confirm dialog before firing.
- Backup path: if `verify.useatrium.me` 404s on judge day, fall back to a pre recorded Loom and a QR to a mirror.

## Copy on screen

Apply `docs/conventions/writing.md` to every label, button, tooltip, error. No banned words. No marketing fluff in product chrome.

## Accessibility

- Color contrast meets WCAG AA on the primary palette
- Every interactive element has a focus ring
- Every icon has a label (visible or aria)
- Forms read top to bottom with one column on mobile
- Keyboard navigation works without a mouse

## Performance budget

- Verifier Mode time to interactive ≤ 1.5s on broadband (Lighthouse)
- Mobile PWA Lighthouse ≥ 90 (perf, a11y, best practices, SEO)
- No client bundle larger than 250KB gzipped on the landing page
- Defer wallet libraries until the user clicks Connect

## What not to do

- Do not add a new color outside the palette extracted from `design/`.
- Do not copy a generic crypto dashboard (token list, big number grid, neon glow).
- Do not show fake TVL or fake activity in screenshots, demos, or social posts.
- Do not pad the page with hero filler. Lead with the product.
- Do not let a half built screen ship behind a dead button.

## Mobile path

Postern + Coinbase Smart Wallet gives passkey login on mobile. The flows that must work touch first:

- Connect wallet
- Deposit USDC
- Open hedged position
- View Lantern attestation
- Kill Switch
- Switch to PWA install

Anything else on mobile is bonus. The five above are required.

## Review checklist before merging UI

- [ ] Matches tokens extracted from `design/`
- [ ] All six states present (empty, loading, error, permission, success, mobile)
- [ ] No mock data shown as real
- [ ] No dead buttons
- [ ] Copy passes `writing.md` rules
- [ ] Keyboard and screen reader tested
- [ ] Lighthouse mobile ≥ 90
- [ ] Verifier Mode flows tested end to end on Sepolia
