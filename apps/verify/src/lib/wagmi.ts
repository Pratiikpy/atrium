import { createConfig, http } from 'wagmi';
import { fallback } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

/**
 * Wagmi config. Arbitrum Sepolia primary per TDD §15.1.
 *
 * Audit XX-1 fix: the prior config declared no `connectors`. wagmi defaults
 * to an empty array; `useConnect().connectors[0]` was always `undefined`;
 * the Connect button stayed permanently disabled. The full Verifier-Mode
 * connect flow was structurally broken before any contract deploy.
 *
 * The connector is `coinbaseWallet` with `preference: 'smartWalletOnly'` —
 * this is the Postern path: passkey-bound smart wallets (ERC-4337 + EIP-7702)
 * that work without a browser extension. Per TDD §15.1 + PRD §22.7 the only
 * connector we need for Year-1 testnet. Additional connectors (WalletConnect,
 * MetaMask) belong behind a Year-2 ADR.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  ssr: true,
  connectors: [
    coinbaseWallet({
      appName: 'Atrium',
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [arbitrumSepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
      http('https://arbitrum-sepolia.publicnode.com'),
      http('https://sepolia-rollup.arbitrum.io/rpc'),
    ]),
  },
});
