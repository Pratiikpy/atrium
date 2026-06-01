/**
 * E2E-ONLY funded-key connector.
 *
 * The production wallet is the Coinbase Smart Wallet (passkey/hosted), which
 * cannot be driven headlessly. To verify the REAL transaction flows (deposit,
 * trade, mandate-sign, kill-switch) through the UI end to end, this builds a
 * wagmi `injected` connector backed by a local viem account from a private
 * key, so clicking "Deposit"/"Sign mandate" produces a REAL signature / tx
 * on Arbitrum Sepolia.
 *
 * STRICTLY gated: only constructed when BOTH `NEXT_PUBLIC_E2E === '1'` AND
 * `NEXT_PUBLIC_E2E_PRIVATE_KEY` are set (see wagmi.ts). The key must be a
 * THROWAWAY testnet key (it ends up in the E2E build bundle), never a real
 * or admin key, never committed, never in a production build.
 */
import { injected } from 'wagmi/connectors';
import {
  createWalletClient,
  createPublicClient,
  http,
  numberToHex,
  type Hex,
  type EIP1193Provider,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'wagmi/chains';

export function e2eKeyConnector(privateKey: Hex, rpcUrl: string) {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpcUrl) });
  const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });

  const provider = {
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      const p = (params ?? []) as unknown[];
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address];
        case 'eth_chainId':
          return numberToHex(arbitrumSepolia.id);
        case 'wallet_switchEthereumChain':
          return null;
        case 'personal_sign':
          // params: [messageHex, address]
          return wallet.signMessage({ message: { raw: p[0] as Hex } });
        case 'eth_signTypedData_v4': {
          // params: [address, typedDataJsonOrObject]
          const td = typeof p[1] === 'string' ? JSON.parse(p[1] as string) : p[1];
          return wallet.signTypedData(td);
        }
        case 'eth_sendTransaction': {
          const tx = p[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
          return wallet.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : undefined,
          });
        }
        default:
          // All reads (eth_call, eth_getBalance, eth_getTransactionReceipt, …)
          // go straight to the real RPC so the UI sees real on-chain state.
          return pub.request({ method: method as never, params: p as never });
      }
    },
    on: () => {},
    removeListener: () => {},
  } as unknown as EIP1193Provider;

  return injected({
    target: () => ({ id: 'e2eKeyWallet', name: 'E2E Key Wallet', provider }),
  });
}
