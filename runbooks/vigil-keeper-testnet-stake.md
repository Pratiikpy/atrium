# Vigil-Keeper Testnet Stake

Procedure for staking the keeper EOA on Arbitrum Sepolia so the vigil-keeper service can execute liquidations.

## Prerequisites

- `cast` CLI (from Foundry)
- Access to Doppler `atrium-staging` config
- Arbitrum Sepolia faucet ETH

## Steps

### 1. Generate keeper EOA

```bash
cast wallet new
# Save the address and private key securely
# This MUST be separate from the deployer EOA
```

### 2. Fund with testnet ETH

Send 0.02 testnet ETH to the keeper address from the Arbitrum Sepolia faucet or an existing funded wallet:

```bash
cast send --rpc-url https://arbitrum-sepolia.publicnode.com \
  --private-key $FUNDER_KEY \
  $KEEPER_ADDRESS \
  --value 0.02ether
```

### 3. Stake via Vigil contract

The Vigil contract (compiled with `--features testnet-stake`) accepts a minimum stake of 0.01 ETH.

```bash
# Using native ETH stake
cast send --rpc-url https://arbitrum-sepolia.publicnode.com \
  --private-key $KEEPER_PRIVATE_KEY \
  $VIGIL_ADDRESS \
  "stakeKeeper()" \
  --value 0.01ether
```

If `stakeViaUSDC` is implemented, wrap to WETH first or use USDC directly.

### 4. Verify stake

```bash
cast call --rpc-url https://arbitrum-sepolia.publicnode.com \
  $VIGIL_ADDRESS \
  "activeKeeperCount()(uint256)"
# Should return > 0
```

### 5. Update Doppler config

```bash
doppler secrets set KEEPER_PRIVATE_KEY=$KEEPER_PRIVATE_KEY \
  --project atrium --config staging --group vigil-keeper
```

## Security Notes

- The keeper EOA holds only the minimum stake + gas. Worst case: leak compromises only stake funds.
- Rotate by generating a new EOA, staking, updating Doppler, then unstaking the old one.
- Never reuse the deployer EOA as the keeper, deployer controls upgrades and multisig proposals.
