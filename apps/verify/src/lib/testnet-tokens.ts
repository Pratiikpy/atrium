/**
 * Audit U-39: canonical testnet-token addresses.
 *
 * Pre-fix the USDC address (`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`,
 * Circle's Arbitrum Sepolia USDC) was hardcoded in two separate files:
 *   - `lib/use-vault-deposit.ts` (wagmi approve target)
 *   - `app/api/transfer/chain-balance/route.ts` (balance read default)
 *
 * Two literals → a future address rotation (Circle re-deploys, we switch
 * to a mock USDC) needs to touch both. Consolidating into a single
 * export means the rotation is a one-line edit. Same pattern as
 * `@/lib/venues` for the venue list.
 *
 * Each constant is overridable via env so operators can wire a different
 * mock token (e.g. for adapter integration tests) without code changes.
 */

export const ARB_SEPOLIA_USDC: `0x${string}` =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ??
  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

export const USDC_DECIMALS = 6;
