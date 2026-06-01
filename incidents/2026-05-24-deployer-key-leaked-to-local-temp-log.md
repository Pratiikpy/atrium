# 2026-05-24: Deployer EOA private key leaked to local temp log

## Summary

The first two runs of `scripts/redeploy-stylus.mjs` echoed the decrypted
deployer EOA private key (for `0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42`)
to stdout via a `console.log` of the spawned cargo-stylus command line.
The console output was tee'd to a local temp log at
`%LOCALAPPDATA%\Temp\stylus-deploy-coffer.log`, so the
plaintext key sat on disk for roughly 90 seconds before the log was
wiped.

## Blast radius

- **Testnet only.** The leaked key controls the deployer EOA on Arbitrum
  Sepolia. No mainnet exposure. ~0.15 Sepolia ETH at risk, plus admin
  rights on the deployed Stylus contracts (until those rights move to
  the 3-of-5 Safe in phase epsilon.1).
- **Local only.** The leak hit local stdout, the local temp log file
  (wiped), and the Claude Code session transcript on this machine. No
  git commit, no remote service, no Vercel env update.
- **No third-party exposure.** docker run accepts the key on argv,
  visible to local processes via `/proc/<pid>/cmdline`, but only to
  the host user.

## Root cause

`scripts/redeploy-stylus.mjs` build-up:
1. A `run()` helper printed the spawned command via `console.log` for
   operator visibility.
2. The cargo-stylus invocation was wrapped in `docker run ... bash -c
   "cargo stylus deploy ... --private-key <key> ..."`. The entire
   `bash -c` string was passed as one argv element.
3. The original redact pass split the argv tokens and looked for
   `--private-key` as a standalone token. It never matched because the
   key was nested inside the bash -c string.

## Fix

Patched in `scripts/redeploy-stylus.mjs:redact()`:
- Treat every string arg as a candidate for in-place regex redaction.
- Match `--private-key[\s=]<value>` and replace `<value>` with
  `***REDACTED***`.
- Last-resort: any `0x` followed by 64 hex chars (the shape of an
  Ethereum private key) is replaced.
- Verified with a regex test before the next deploy run.

## Required follow-up

- [ ] Rotate the deployer EOA before flipping any mainnet flag. Move
      remaining ETH + admin ownership of every Stylus contract via
      PraetorTimelock (48h) to a fresh EOA generated offline.
- [ ] Schedule the rotation in `human_left.md` so it isn't missed.
- [ ] Add a CI check in `.github/workflows/ci.yml` that greps the
      working tree for `0x[0-9a-fA-F]{64}` and fails on match (catches
      any future leak before commit).

## Lessons

- Redaction must cover the literal commandline string, not just the
  argv array shape it was constructed from.
- Operator visibility comes second to key safety. Default-redact at
  the run helper, opt-in to verbose printing only with `DEBUG=1`.
- A leaked key on testnet is still a leak. Treat key-handling code
  with mainnet rigor even when the only fund at risk is faucet ETH.
