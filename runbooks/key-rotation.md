# Runbook — key rotation

Applies to: Lantern signing key, Codex backend HMAC key, Keeper bot keys.

Praetor multisig and EOA founder hardware wallets are out of scope here — those rotate per their own physical-security procedure.

## Lantern signing key (annual)

1. Generate a fresh secp256k1 private key offline on an air-gapped machine.
2. Derive the public address. Update `LanternAttestor.signing_key` via `praetor multisig schedule --target lantern-attestor --call <abi-encode setSigningKey(newAddress)>`.
3. Encrypt the new private key on disk with Argon2id and a fresh passphrase.
4. Split the new key 3-of-5 via Shamir secret sharing (`ssss` CLI). Distribute shares to founders + 2 trusted advisors via separate physical channels.
5. After the 48h timelock, execute the multisig action.
6. Run `praetor lantern publish-now` to confirm the new key produces a valid attestation.
7. Securely erase the previous key from the VPS using `shred -u`.
8. Document the rotation in `/incidents/key-rotation-YYYYMMDD.md`.

## Codex HMAC key (quarterly)

1. Generate a 32-byte random secret.
2. Set the new secret via `wrangler secret put CODEX_HMAC_KEY`.
3. Increment `CODEX_KEY_ID` to the next version, e.g. `v1` → `v2`.
4. Deploy Codex (`pnpm --filter @atrium/codex deploy`).
5. Keep the previous key valid for 24 hours via dual-verify in `sign-response.ts` for client compatibility.
6. Remove the previous key after 24 hours.

## Keeper bot keys (on compromise only)

1. Stop the affected keeper process.
2. Run `praetor keepers slash --keeper <addr> --reason "compromised"` to remove the keeper from the active set.
3. Generate a new keeper EOA.
4. Run `praetor keepers stake --keeper <new-addr> --amount <wei>` to onboard the replacement.
5. Update the VPS env files with the new private key.
6. Restart the keeper process.

## Chaos drill key (per drill)

The Chaos Mode (Phase ζ.5) uses an isolated EOA so a drill cannot
accidentally leak the deployer or keeper key. Rotate before every
demo + after every public rehearsal.

1. Generate a fresh EOA: `cast wallet new`.
2. Fund with ≤ 0.02 ETH from the deployer (drill-budget only).
3. Add to the Praetor multisig as a chaos-only operator (cannot
   schedule timelock txs, only invokes emergencyPause via the CLI).
4. Update `CHAOS_PRIVATE_KEY` env in the GHA chaos workflow.
5. After the drill: zero the key on disk + rotate per this section.

## Sumsub webhook secret (on compromise or quarterly)

The KYC webhook (Phase η.3) signs each callback with a shared secret.
A compromise lets an attacker fabricate tier-upgrade events that
move users into higher-leverage tiers without real KYC.

1. Open the Sumsub dashboard → Integrations → Webhooks → Rotate.
2. Copy the new secret.
3. Update `SUMSUB_WEBHOOK_SECRET` in:
   - Vercel verify-app project env (production + preview)
   - GHA repo secrets (for any cron that mirrors webhook events)
4. Trigger a test webhook from the Sumsub dashboard. Confirm the
   `/api/edict/sumsub-webhook` route returns 200 with a valid
   signature check.
5. The old secret stops working immediately — confirm any in-flight
   webhook retry from Sumsub is also re-signed.

## Research signer key (on compromise or annual)

`RESEARCH_SIGNER_KEY` signs the weekly `publishBacktest` tx. A leaked
key lets an attacker publish a counterfeit ResearchAttestation that
the /research page would display as canonical.

1. Generate a fresh secp256k1 key offline.
2. Update `RESEARCH_SIGNER_KEY` in `.github/workflows/archive-weekly.yml`
   repo secrets.
3. Call `ResearchAttestation.setSigner(newAddress)` via the Praetor
   multisig (48h timelock).
4. After timelock execution, trigger `archive-weekly` via
   `workflow_dispatch` to confirm the new signer is accepted.
5. Document the rotation in `/incidents/key-rotation-YYYYMMDD.md`.

## Notifier internal key (on compromise or quarterly)

`ATRIUM_INTERNAL_KEY` is the Bearer token the notifier service passes
to the verify-app's `/api/settings/notifications` route (Phase θ.2
auth fix). A leak lets an attacker read or overwrite any user's
notification prefs.

1. Generate a 32-byte random secret: `openssl rand -hex 32`.
2. Set in BOTH places at the same time so no in-flight tick is
   rejected:
   - GHA repo secret `NOTIFIER_INTERNAL_KEY` (consumed by
     `.github/workflows/notifier-cron.yml` as `ATRIUM_INTERNAL_KEY`)
   - Vercel verify-app project env `ATRIUM_INTERNAL_KEY`
3. Trigger a notifier tick via `workflow_dispatch`. Confirm the tick
   log shows successful `fetchPrefs` (not 401).
4. Old secret stops working at the next tick — no draining required.
