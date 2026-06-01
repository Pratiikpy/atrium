# Loadtest EOA Runbook

## Purpose

The loadtest service uses a dedicated testnet EOA that is separate from the deployer. This limits blast radius: if the key leaks, only loadtest funds are compromised.

## Initial Setup

### 1. Generate EOA

```bash
cast wallet new
# Record address and private key
```

### 2. Fund with testnet assets

```bash
# ETH for gas (from faucet or existing wallet)
cast send --rpc-url https://arbitrum-sepolia.publicnode.com \
  --private-key $FUNDER_KEY \
  $LOADTEST_ADDRESS \
  --value 0.5ether

# Testnet USDC (mint from faucet contract if available)
cast send --rpc-url https://arbitrum-sepolia.publicnode.com \
  --private-key $FUNDER_KEY \
  $USDC_ADDRESS \
  "mint(address,uint256)" \
  $LOADTEST_ADDRESS \
  1000000000  # 1000 USDC (6 decimals)
```

### 3. Configure in Doppler

```bash
doppler secrets set LOADTEST_EOA_KEY=0x<private-key> \
  --project atrium --config staging --group loadtest
```

## Rotation

1. Generate new EOA: `cast wallet new`
2. Fund new EOA with testnet ETH + USDC
3. Update Doppler: `doppler secrets set LOADTEST_EOA_KEY=0x<new-key>`
4. (Optional) Drain old EOA back to funder

## Security Notes

- NEVER use the deployer key (`DEPLOYER_PRIVATE_KEY`) for load testing
- The loadtest wallet.ts will refuse to start if `LOADTEST_EOA_KEY` equals `DEPLOYER_PRIVATE_KEY`
- Keep loadtest funds minimal, just enough for a test run
- Rotate after any suspected exposure
