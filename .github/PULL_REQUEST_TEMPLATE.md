## What changed

<!-- One-paragraph description in present tense. Lead with the noun. -->

## Why now

<!-- The "why" that the diff does not explain. Link the user pain, the
audit finding, or the upstream incident. -->

## How it was tested

- [ ] `cargo test --workspace` green (or N/A for non-Rust)
- [ ] `forge test` green (or N/A for non-Solidity)
- [ ] `pnpm vitest run` green (or N/A for non-frontend)
- [ ] `pnpm exec tsc --noEmit` green (or N/A)
- [ ] Manual: walked the end-to-end flow on Sepolia
- [ ] Kani: `cargo kani` green (only if contracts/ changed)

## Risk + follow-up

<!-- Any known risk this PR ships with. Any follow-up needed. Link to
human_left.md or the relevant tripwires entry if applicable. -->

## Screenshots / video

<!-- For UI PRs. Loom or video file preferred for flows; static screenshots
fine for component-level work. -->

## Checklist

- [ ] No fake numbers / no AI-coauthor lines / no banned words
      (.claude/rules/writing.md)
- [ ] Empty + loading + error + success states implemented
      (.claude/rules/ui.md, if UI changes)
- [ ] No new dependency without justification
- [ ] Commit body explains the "why", not the "what"
