# Atrium Verifier E2E suite

Five end-to-end journeys per TDD §9. Each test runs in one of two modes:

| Mode | Trigger | What is asserted |
|---|---|---|
| local | `pnpm test:e2e` (default) | Honest pending UI: disabled buttons, helper copy naming the missing contract, "pending" badges. Verifies the real-data discipline holds before deployment. |
| sepolia | `E2E_MODE=sepolia pnpm test:e2e` | Real tx hashes, Arbiscan links, post-success UI transitions. Lights up only once Stylus contracts deploy (the internal ops log). |

## The five journeys

1. **`01-connect-wallet.spec.ts`** — Postern passkey login.
2. **`02-deposit-usdc.spec.ts`** — Coffer vault deposit.
3. **`03-open-hedged-position.spec.ts`** — Plinth + adapters open path.
4. **`04-view-lantern-attestation.spec.ts`** — Hourly proof of reserves.
5. **`05-kill-switch.spec.ts`** — Revoke all session keys + mandates in one tx.

## Running

```bash
# local mode (default — auto-starts `next dev`)
pnpm test:e2e

# specific journey
pnpm test:e2e --grep "deposit"

# mobile path only
pnpm test:e2e --project=mobile-safari

# sepolia mode (against deployed contracts)
E2E_MODE=sepolia E2E_BASE_URL=https://verify.atrium.fi pnpm test:e2e
```

## Updating tests after deployment

When Stylus contracts deploy and the API routes flip from `source: 'pending'` to
`source: 'plinth' | 'coffer' | ...`, swap the pending-state assertions for
tx-hash assertions. Each test has a `// SEPOLIA:` comment marking the line to
flip.
