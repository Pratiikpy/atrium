# Codex Deploy Runbook

## Pay-To Address Configuration

The `CODEX_PAY_TO_ADDRESS` is the on-chain address that receives x402 USDC payments for Codex API access.

### Initial Setup

1. Generate a Coffer-deposit-derived address controlled by the Praetor multisig
2. Set in Doppler:
   ```bash
   doppler secrets set CODEX_PAY_TO_ADDRESS=0x<address> \
     --project atrium --config staging --group codex
   ```
3. Deploy the service, it will fail loudly at startup if the address is missing or invalid

### Rotation Procedure

1. Generate new receiving address from Praetor multisig
2. Update Doppler:
   ```bash
   doppler secrets set CODEX_PAY_TO_ADDRESS=0x<new-address> \
     --project atrium --config prod --group codex
   ```
3. Redeploy the service (Vercel auto-deploys on env change if configured)
4. Verify: `curl -I https://codex.atrium.fi/health` should return 200
5. Old address continues receiving in-flight payments for up to 5 minutes (payment TTL)

### Verification

```bash
# Check the service starts correctly
curl https://codex.atrium.fi/health

# If CODEX_PAY_TO_ADDRESS is unset, the service refuses to start
# and logs: "[codex] FATAL: CODEX_PAY_TO_ADDRESS is not configured"
```

### Security Notes

- The pay-to address MUST be controlled by the Praetor multisig (not a single EOA)
- Never use the deployer EOA as the pay-to address
- The address is public (visible in x402 payment headers), security comes from multisig control, not secrecy
