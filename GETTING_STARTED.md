# Getting started with Atrium

How to use Atrium end to end, as a real user, on testnet. Everything here is live
on Arbitrum Sepolia (chain 421614) today. No real funds are at risk.

> The app reads the live Arbitrum Sepolia contracts directly. Run it locally with
> `make demo-frontend` (works on Windows; the full `make demo` needs Linux, macOS,
> or WSL for the Stylus linker). Live at https://www.useatrium.me .

---

## What you need

- A browser wallet. Rabby or MetaMask both work; the app uses the standard
  wallet-connect path.
- The Arbitrum Sepolia network (chain id **421614**, RPC
  `https://arbitrum-sepolia.publicnode.com`). The app prompts you to switch if your
  wallet is on another chain.
- Nothing else. You will faucet your own testnet USDC and ETH in step 2.

---

## 1. Connect and sign in

1. Open the app and click **Open testnet** (or go to `/app`).
2. Connect your wallet. The app uses Sign-In-With-Ethereum (SIWE): you sign one
   message so the app can read *your* wallet-scoped data (your balance, your margin,
   your mandates) without a password. No transaction, no gas.
3. If your wallet is on the wrong network you will see **"Wrong network. Atrium runs
   on Arbitrum Sepolia"** with a one-click **Switch to Arbitrum Sepolia** button.

After signing in, the sidebar shows your address and `arbitrum-sepolia`.

## 2. Get testnet funds

Atrium ships its own faucet so a fresh user can run the whole flow.

1. Go to `/app/onboarding` (the Faucet step) or use Verifier Mode.
2. Claim. The faucet (`0x7f3a714c824c0926ae98ecfb2e59513e78d82bbc`) drops
   **5 testnet USDC + 0.0005 ETH per claim**, with a **24-hour cooldown** per wallet.
   The ETH covers gas; the USDC is your collateral.
3. If you already claimed within 24 hours, the button is disabled and shows the exact
   cooldown remaining. That is the honest cooldown, not a failure.

Testnet USDC on Arbitrum Sepolia is `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`.

## 3. Deposit into the vault

The vault is **Coffer**, an ERC-4626 contract. Depositing mints you shares that
Plinth reads as collateral.

1. Go to `/app/vault`.
2. Enter an amount (or tap **Max** to use your full balance) and click **Deposit**.
   Amounts above your balance disable the button with an insufficient-balance note;
   a zero amount keeps it disabled.
3. Your wallet pops up to two transactions: an ERC-20 approval, then the deposit. The
   button reports success only after the deposit mines on-chain.
4. The stat cards update from a live RPC read: **Vault TVL** (`Coffer.totalAssets()`),
   **Your value** (`convertToAssets(your shares)`), and **Your shares**. Reload the
   page and the new balance persists, because it is on-chain state, not optimistic UI.

A deposit is fully conserved: USDC in equals the value increase equals the TVL
increase equals the new shares at the share price. You can confirm every leg.

## 4. See your unified margin

1. Go to `/app/portfolio`.
2. The four tiles read live: **Buying power** (Plinth cross-product margin),
   **Total collateral** (across the live venues), **Open notional**, and **24h P&L**.
   With no open position they honestly show `$0` and `-`, not invented numbers.
3. The **Account health** card explains the core idea: required margin drops when
   your positions offset, so the same collateral backs more.

## 5. Preview and open a position

1. Go to `/app/trade`.
2. Pick a venue and type a size. The **margin impact** panel computes live from the
   real SPAN engine: type `1000` and it shows an initial margin, a maintenance
   margin, the resulting buying power, and the liquidation buffer. This is the core
   value proposition you can see update as you type.
3. **Open the live margin compare on Trade** (linked from `/app/markets`) shows the
   cross-venue netting saving as a labelled worked example.

Note: enabling a *live fill* on a venue is gated behind the 48-hour PraetorTimelock,
exactly as a production parameter change would be. The contracts are deployed and
wired; until the timelock batch executes for a venue, the form previews margin but
the fill is held. The UI says so rather than submitting a transaction that cannot
land.

## 6. Delegate to an agent, and revoke

Atrium makes AI agents first-class users through bounded mandates.

1. Go to `/app/agents` and click **New mandate** (or open an agent profile and click
   **Issue mandate**, which pre-fills the recommended caps).
2. Set the caps: per-action cap, total open cap, actions per day, expiry, and the
   venue allowlist. These are limits the agent physically cannot exceed.
3. Click **Sign mandate**. Your wallet shows the EIP-712 typed data (primary type
   `IntentSigil`, domain `AtriumSigil`, chain 421614). Sign it. You get an intent
   hash to hand to the agent; the mandate is the signed envelope.
4. To revoke everything at once, the **Emergency stop** card on `/app/portfolio` has
   **Activate kill switch**, guarded by an "this is irreversible" confirmation. It
   revokes every mandate and session key in one batched transaction (Postern Kill
   Switch routes through `Sigil.revoke_all_on_behalf_of`).

## 7. Verify proof of reserves yourself

Atrium never custodies your funds, and it proves the reserves.

1. Go to `/app/reserves` (or the public `/lantern`).
2. You see the latest signed Merkle root, the block it was attested at, and the leaf
   count. Lantern publishes a fresh root roughly every 10 minutes.
3. Click **Verify my balance**. The server recomputes the published tree's root,
   checks it equals the on-chain attested root, and verifies your wallet's inclusion
   proof. You get a real verified / not-included / pending result, never a fake
   "verified".

## 8. Verifier Mode (verify every claim)

`/verify` is the judge-facing walkthrough: seven steps run against the live
contracts.

1. Deposit USDC into Coffer (a small `$1` demo deposit, affordable with one faucet
   claim).
2. Open a position.
3. See the margin saving.
4. Trigger Chaos Mode (an injected fault with a graceful recovery path).
5. Run a liquidation drill.
6. Verify proof of reserves.
7. Kill Switch revoke.

Each step either runs its real action with a result and an Arbiscan link, or shows
an honest "step not ready" blocker naming the missing dependency. No step fakes a
success.

---

## Honest notes

- **Testnet only.** No economic value. Funds come from the faucet.
- **Cross-chain transfer** (`/app/transfer`) is built but the CCIP lane to the
  destination chain is not deployed on testnet yet, so the transfer button is
  disabled with an honest reason and shows your real balances.
- **Tax export** (`/app/tax`) is gated on the Tablet service, which deploys later;
  the export buttons are disabled with an honest note rather than returning an error.
- The full list of what is mocked, relayed, or pending on testnet is published on the
  live app at `/docs/honesty`.

## Troubleshooting

- **Wrong network:** the app shows a Switch-to-Arbitrum-Sepolia prompt; click it and
  approve in your wallet.
- **Faucet says cooldown:** you claimed within the last 24 hours; wait for the
  countdown shown, or use a different wallet.
- **Deposit button disabled:** you entered more than your balance, or zero. Use
  **Max** or a smaller amount.
- **A button shows "pending" or "not ready":** that surface depends on a contract or
  service that deploys later. The UI names the dependency; it is gated, not broken.
