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
