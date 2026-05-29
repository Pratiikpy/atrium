# PGP Key Generation

Generate the `security@atrium.fi` PGP key for vulnerability disclosure encryption.

## Prerequisites

- Air-gapped or offline machine (preferred)
- GPG installed (`gpg --version` ≥ 2.2)
- 1Password Team vault access (for private key storage)

## Steps

### 1. Generate key

```bash
gpg --full-generate-key
```

Prompts:
- Kind: **(1) RSA and RSA**
- Keysize: **4096**
- Expiration: **1y**
- Real name: **Atrium Security**
- Email: **security@atrium.fi**
- Passphrase: strong passphrase (store in 1Password) OR empty if on air-gapped machine

### 2. Export public key

```bash
gpg --armor --export security@atrium.fi > pgp.asc
```

### 3. Place in repo

Copy `pgp.asc` to:
```
apps/verify/public/security/pgp.asc
```

Remove the `.placeholder` suffix file once the real key is in place.

### 4. Update security.txt

Ensure `apps/verify/public/.well-known/security.txt` references:
```
Encryption: https://verify.atrium.fi/security/pgp.asc
```

### 5. Test import

On a clean machine:
```bash
gpg --import pgp.asc
gpg --list-keys security@atrium.fi
```

### 6. Test encrypt/decrypt

```bash
echo "test" | gpg --armor --encrypt -r security@atrium.fi > test.asc
gpg --decrypt test.asc  # should output "test"
rm test.asc
```

### 7. Store private key

1. Export: `gpg --armor --export-secret-keys security@atrium.fi > private.asc`
2. Store `private.asc` in 1Password Team vault under "Atrium PGP Key".
3. Two team members must have access.
4. Delete `private.asc` from disk: `shred -u private.asc`

### 8. Set renewal reminder

- Calendar reminder: 11 months from generation date.
- Renewal: `gpg --edit-key security@atrium.fi` → `expire` → set new 1y expiry → re-export.
