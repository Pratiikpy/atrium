import { createConfig, http } from 'wagmi';
import { fallback } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, mock } from 'wagmi/connectors';
import { e2eKeyConnector } from './e2e-key-connector';

/**
 * E2E-ONLY mock connector. The production connector is the Coinbase Smart
 * Wallet (passkey/hosted flow), which cannot be driven headlessly in
 * Playwright. STRICTLY gated on NEXT_PUBLIC_E2E === '1' so it is NEVER present
 * in a real build (a mock connector in prod would be a security hole). When
 * set, Playwright connects this deterministic account and the app reads REAL
 * Arbitrum Sepolia state for it via the transport below (honest zeros if the
 * test address is unfunded). Lets the connect + read flows be verified
 * without the Coinbase passkey UI. Address overridable via NEXT_PUBLIC_E2E_ADDRESS.
 */
const E2E_RPC =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';

const e2eConnectors =
  process.env.NEXT_PUBLIC_E2E === '1'
    ? process.env.NEXT_PUBLIC_E2E_PRIVATE_KEY
      ? // Funded throwaway key → real signatures + real txs through the UI
        // (deposit / trade / mandate / kill-switch). See e2e-key-connector.ts.
        [
          e2eKeyConnector(
            process.env.NEXT_PUBLIC_E2E_PRIVATE_KEY as `0x${string}`,
            E2E_RPC,
          ),
        ]
      : // No key → read-only mock connector (connect + read flows only).
        [
          mock({
            accounts: [
              (process.env.NEXT_PUBLIC_E2E_ADDRESS ??
                '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266') as `0x${string}`,
            ],
            features: { defaultConnected: false },
          }),
        ]
    : [];

/**
 * Wagmi config. Arbitrum Sepolia primary per TDD §15.1.
 *
 * Audit XX-1 fix: the prior config declared no `connectors`. wagmi defaults
 * to an empty array; `useConnect().connectors[0]` was always `undefined`;
 * the Connect button stayed permanently disabled. The full Verifier-Mode
 * connect flow was structurally broken before any contract deploy.
 *
 * Two real connectors, both Year-1:
 *  - `injected()`, any browser-extension EVM wallet (MetaMask, Rabby, Brave).
 *    This is what most users + buildathon judges actually have, and it is what
 *    @tenkeylabs/dappwright drives for the real-wallet E2E. Added after the
 *    persona sweep flagged that a plain MetaMask user could not connect at all.
 *  - `coinbaseWallet` with `preference: 'smartWalletOnly'`, the Postern path:
 *    passkey-bound smart wallets (ERC-4337 + EIP-7702), no extension needed.
 * The connect UI offers both; injected is primary so a MetaMask/Rabby user
 * connects in one click.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  ssr: true,
  connectors: [
    // E2E mock first (when gated on) so the connect-wallet control's
    // connectors[0] resolves to it; empty in every real build.
    ...e2eConnectors,
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Atrium',
      // telemetry:false stops the SDK's load-time analytics beacon; the CSP
      // blocks its endpoint anyway, which surfaced as a console TypeError on
      // every /app page (privacy stance unchanged, just no failed fetch).
      preference: { options: 'smartWalletOnly', telemetry: false },
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
