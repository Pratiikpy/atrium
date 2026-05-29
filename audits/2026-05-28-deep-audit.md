# ANTIGRAVITY DEEP AUDIT REPORT — ATRIUM PROJECT

**Audit Date:** May 28, 2026  
**Auditor Mindset:** Ruthless Security Auditor, Prime-Brokerage UX Designer, Venture Capitalist, and Technical Cofounder  
**Scope:** Core Smart Contracts (`contracts/`), Backend Services & Workers (`services/`), Next.js Web App (`apps/verify/`), CI/CD Workflows (`.github/workflows/`), Docker Configurations, and Public/Developer Documentation.  
**Absolute Mandate:** *"No compromise. Always the best possible option. Always the right way."*

---

## 🔍 I. SYSTEM ARCHITECTURE OVERVIEW

The Atrium Protocol is an ambitious, high-fidelity cross-venue portfolio margin prime brokerage system deployed primarily on Arbitrum Sepolia (and soon the Robinhood Chain). The codebase is highly modular and structured as a monorepo containing:
1. **Core Smart Contracts (`contracts/`)**: Written in Stylus (Rust) for performance-critical execution (`Plinth`, `PlinthMath`, `Vigil`, `Coffer`, `Sigil`) and Solidity for integrations/bridges (`Aqueduct`, `AtriumRouter`, and venue adapters).
2. **Backend Microservices (`services/`)**: Powering key off-chain routines, including indexers (`Scribe`), transaction relays (`notifier`), tax reporting calculators (`tablet`), Proof-of-Reserves Merkle publishers (`lantern-attestor`), and automated liquidator keepers (`vigil-keeper`).
3. **Frontend Application (`apps/verify/`)**: A Next.js 15+ Web3 interface providing dashboards, account controls, and verification pages built using a warm parchment-and-ink visual aesthetic.

### Architectural Evaluation
The overall design of Atrium shows strong technical competence: the separation of concerns is clean, virtual share offsets protect Coffer vaults against ERC-4626 inflation vectors, and the reentrancy and access controls show deep structural design. 

However, the "last mile" of development has suffered from dangerous shortcut compromises: **leaked environment keys, critical math edge cases returning zero margin requirements, unauthenticated user API queries disclosing PII, severe SQL/subgraph pagination bottlenecks causing silent data loss, non-functional integration endpoints, broken Docker files, extreme GitHub Actions quota exhaustion, and visual/brand identity alignment failures.** 

This audit exposes every single compromise across the system to ensure Atrium's testnet and mainnet builds reflect pure, institutional-grade quality.

---

## ⚠️ II. FINDINGS MATRIX BY SEVERITY

| Finding ID | Severity | Area | Coordinate / Target | Description |
| :--- | :---: | :--- | :--- | :--- |
| **ATRIUM-CRT-01** | 🔴 **Critical** | Contracts | `plinth-math/src/lib.rs` | Array length mismatches in SPAN margin calculations return zero required margin. |
| **ATRIUM-CRT-02** | 🔴 **Critical** | Backend | `notifier/src/channels/webhook.ts` | Server-Side Request Forgery (SSRF) in user-defined webhook notifications. |
| **ATRIUM-CRT-03** | 🔴 **Critical** | Frontend | `globals.css` & `atrium-mobile.css` | Typographic brand breakage (Instrument Serif rendering as Geist). |
| **ATRIUM-CRT-04** | 🔴 **Critical** | Frontend | `atrium-mobile.css` | Touch targets under 44px (timeframe buttons) violating WCAG AA compliance. |
| **ATRIUM-CRT-05** | 🔴 **Critical** | Frontend | `atrium-mobile.css` | Base body font size under 16px triggering browser auto-zoom on inputs. |
| **ATRIUM-CRT-06** | 🔴 **Critical** | DevOps | `archive-weekly.yml` | Shell injection vulnerability in weekly research backtest inputs. |
| **ATRIUM-HIGH-01** | 🟠 **High** | Contracts | `plinth-math/src/lib.rs` | Signed division in PnL calculations rounds toward zero, under-representing portfolio losses. |
| **ATRIUM-HIGH-02** | 🟠 **High** | Contracts | `aqueduct/src/Aqueduct.sol` | Centralized multisig timelock bypass inside bridge resumption logic. |
| **ATRIUM-HIGH-03** | 🟠 **High** | Contracts | `vigil/src/lib.rs` | Pause state bypass in `queue_liquidation` leads to expired jobs and bad debt. |
| **ATRIUM-HIGH-04** | 🟠 **High** | Contracts | `coffer/src/lib.rs` | Approved adapters bypass Coffer global withdrawal pauses. |
| **ATRIUM-HIGH-05** | 🟠 **High** | Backend | `api/transfer/*` & `api/notifications` | Unauthenticated APIs leaking wallet balances, quotes, recent history, and inboxes. |
| **ATRIUM-HIGH-06** | 🟠 **High** | Backend | `api/agents/my-mandates` | Unauthenticated active mandate disclosure leaking wallet-agent delegation. |
| **ATRIUM-HIGH-07** | 🟠 **High** | Backend | `notifier/src/tick.ts` | Hardcoded pagination (`first: 100`) causing silent drop of liquidation alerts. |
| **ATRIUM-HIGH-08** | 🟠 **High** | Backend | `lantern-attestor/src/scribe.ts` | Hardcoded pagination (`first: 1000`) silently omitting users from PoR Merkle trees. |
| **ATRIUM-HIGH-09** | 🟠 **High** | Backend | `tablet/src/scribe_client.py` | Trade history pagination capped (`first: 1000`), generating corrupt tax CSV returns. |
| **ATRIUM-HIGH-10** | 🟠 **High** | Backend | `tablet/src/jurisdictions/de.py` | Lack of USD-EUR FX layer, assumes 1:1 parity in FIFO calculations. |
| **ATRIUM-HIGH-11** | 🟠 **High** | Backend | `tablet/src/jurisdictions/uk.py` | Lack of USD-GBP FX layer, outputs USD values into GBP HMRC SA108 CSVs. |
| **ATRIUM-HIGH-12** | 🟠 **High** | Backend | `api/tax/export` | Integration bug: exports fail with 422 because required address/dates are missing. |
| **ATRIUM-HIGH-13** | 🟠 **High** | Backend | `api/tax/{summary, events}` | Integration bug: calls non-existent, unimplemented endpoints on Python Tablet. |
| **ATRIUM-HIGH-14** | 🟠 **High** | Frontend | `MobileLanding.tsx` & `MobileApp.tsx` | Extensive hardcoded mock stats, metrics, TVL, and fake live-activity feeds. |
| **ATRIUM-HIGH-15** | 🟠 **High** | DevOps | `.dockerignore` | Mismatched directory exclusions breaking docker builds from workspace root. |
| **ATRIUM-HIGH-16** | 🟠 **High** | DevOps | `notifier-cron.yml` & `vigil-keeper.yml` | Missing workflow concurrency controls causing cursor and tx EOA nonce race collisions. |
| **ATRIUM-MED-01** | 🟡 **Medium** | Contracts | `vigil/`, `coffer/`, `sigil/` | Initialization EOA-hijacking and front-running windows on Stylus deployments. |
| **ATRIUM-MED-02** | 🟡 **Medium** | Contracts | `plinth-oracle/src/lib.rs` | Incomplete Chainlink `latestRoundData` validation ignoring round health. |
| **ATRIUM-MED-03** | 🟡 **Medium** | Contracts | `adapters/aave-horizon/` | Liquidity shortfall in Aave forces false portfolio losses and deletes collateral. |
| **ATRIUM-MED-04** | 🟡 **Medium** | Backend | `api/chaos/*` | Chaos injection rate limiters stored locally in in-memory Maps (bypassed on cold starts). |
| **ATRIUM-MED-05** | 🟡 **Medium** | DevOps | `notifier-cron.yml` | Extreme 1-minute cron exhausting GitHub Actions quota in under 33 hours. |
| **ATRIUM-MED-06** | 🟡 **Medium** | DevOps | `ci.yml` | Missing job-level timeouts (`timeout-minutes`) allowing hung pipelines to run 6 hours. |
| **ATRIUM-MED-07** | 🟡 **Medium** | DevOps | `agents-cron.yml` & `notifier-cron.yml` | Silent workflow failures due to missing operational alerting hooks (webhooks). |
| **ATRIUM-MED-08** | 🟡 **Medium** | Frontend | `verifier-step-runner.tsx` | standard `Loader2` rotating spinners violate the "shimmer skeletons only" rule. |
| **ATRIUM-MED-09** | 🟡 **Medium** | Frontend | `portfolio/page.tsx` & `page.tsx` | Inline OKLCH style pollution and raw `color-mix()` gradients bypass variables. |
| **ATRIUM-MED-10** | 🟡 **Medium** | Frontend | `leaderboard.tsx` | Swallowed indexing errors return empty arrays, bypassing standard error states. |

---

## 🔴 III. CRITICAL SEVERITY FINDINGS

### ATRIUM-CRT-01: Array Mismatch in SPAN Calculations Returns Zero Required Margin
*   **Coordinate:** `contracts/plinth-math/src/lib.rs:L60-70`
*   **Logical Vulnerability:** The contract verifies array lengths across portfolio parameters. If a length mismatch is identified (e.g. from an encoded input array mismatch), instead of reverting, it returns `U256::ZERO`.
*   **Impact:** A zero margin requirement represents absolute solvency. By intentionally submitting mismatched arrays to the Plinth engine (potentially through custom router execution), any under-collateralized or highly insolvent portfolio will successfully bypass health assessments. This permits unbounded leverage generation and evades standard liquidation keeper checks.
*   **Remediation Blueprint:** Force the calculation to revert with a dedicated Stylus error rather than returning `ZERO`:
    ```rust
    sol! { error ArrayLengthMismatch(); }
    if n == 0 || entry_prices_q64.len() != n || current_prices_q64.len() != n || haircuts_bps.len() != n || correlation_classes.len() != n {
        return Err(PlinthError::code(ERR_ARRAY_MISMATCH));
    }
    ```

### ATRIUM-CRT-02: Server-Side Request Forgery (SSRF) in Webhook Delivery
*   **Coordinate:** `services/notifier/src/channels/webhook.ts:21-29`
*   **Logical Vulnerability:** User-supplied webhook destination URLs are queried directly using the serverless worker's fetch engine with no domain or host IP validation.
*   **Impact:** Exploitable by registers targeting local hostnames (`localhost`, `127.0.0.1`), private RFC 1918 subnets (`10.0.0.0/8`, `192.168.0.0/16`), or cloud environment metadata endpoints (`169.254.169.254`). Because the query runs from within the backend system's internal network, attackers can retrieve sensitive cloud configurations, bypass external firewalls, or manipulate internal REST endpoints.
*   **Remediation Blueprint:** Enforce secure DNS resolution checking, restrict protocol schemes strictly to HTTPS, and filter out loopback and private subnets:
    ```typescript
    const addresses = await dns.resolve(new URL(config.customWebhookUrl).hostname);
    for (const ip of addresses) {
      if (isPrivateOrLoopback(ip)) throw new Error("Forbidden endpoint target");
    }
    ```

### ATRIUM-CRT-03: Typographic Brand Breakage (Serif Font Rendered as Sans)
*   **Coordinate:** `apps/verify/src/app/globals.css:L337-338` & `apps/verify/src/styles/atrium-mobile.css:L75`
*   **Logical Vulnerability:** The core display font classes `.serif` and `.serif-i` (meant to represent the premium `Instrument Serif` brand voice) are explicitly mapped in CSS to render using `var(--sans)` (Geist).
*   **Impact:** Completely breaks the visual identity and premium "parchment and ink" aesthetic. Important headings and titles fall back to generic sans-serif, appearing visually broken to users, judges, and investors.
*   **Remediation Blueprint:** Fix the CSS mappings to reference the serif variable:
    ```css
    .serif { font-family: var(--serif); font-style: normal; }
    .serif-i { font-family: var(--serif); font-style: italic; }
    ```

### ATRIUM-CRT-04: Timeframe Toggle Touch Target Failure on Mobile Viewports
*   **Coordinate:** `apps/verify/src/styles/atrium-mobile.css:L1075-1077`
*   **Logical Vulnerability:** Timeframe toggle buttons inside mobile perp charts are styled with a tiny font and narrow vertical padding, resulting in a height of only `20.5px`.
*   **Impact:** Directly violates WCAG AA accessibility standards, which mandate touch targets of at least 44px by 44px. This makes timeframe selection error-prone and frustrates mobile users.
*   **Remediation Blueprint:** Apply vertical sizing safeguards inside the CSS file:
    ```css
    .atrium-m-root .timeframe button {
      min-height: 44px; min-width: 44px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    ```

### ATRIUM-CRT-05: Mobile Base Body Font Size Below WCAG Standards
*   **Coordinate:** `apps/verify/src/styles/atrium-mobile.css:L32` & `L790`
*   **Logical Vulnerability:** Root sizes for the mobile viewport are set explicitly to `15px` and `14px`.
*   **Impact:** Violates WCAG AA 16px readability standard on mobile viewports. On iOS and Android, focus events on form fields automatically trigger a page-zoom when the font size is below 16px, disrupting the user experience.
*   **Remediation Blueprint:** Raise base mobile typography levels to a standard `16px`.

### ATRIUM-CRT-06: Shell Command Injection in Weekly Research Workflows
*   **Coordinate:** `.github/workflows/archive-weekly.yml:L45-47`
*   **Logical Vulnerability:** Direct interpolation of the untrusted dispatch input `${{ github.event.inputs.strategy }}` inside a raw bash script step.
*   **Impact:** Attackers can escape double quotes and inject arbitrary shell command chains (e.g. `mean-reversion-v1"; curl ...`) to run malicious programs on the CI runner, exposing vital secrets (`RESEARCH_SIGNER_KEY`, `WEB3_STORAGE_TOKEN`, and deployment private keys) to external theft.
*   **Remediation Blueprint:** Bind all untrusted workflow inputs securely to step-level environment variables, avoiding direct shell interpolations:
    ```yaml
    env:
      INPUT_STRATEGY: ${{ github.event.inputs.strategy }}
    run: |
      python -m services.archive.src.research_loop --strategy "${INPUT_STRATEGY:-mean-reversion-v1}"
    ```

---

## 🟠 IV. HIGH SEVERITY FINDINGS

### ATRIUM-HIGH-01: Signed Division in PnL Calculations Under-represents Portfolio Losses
*   **Coordinate:** `contracts/plinth-math/src/lib.rs:L152`
*   **Logical Vulnerability:** The portfolio valuation division `notional_signed.saturating_mul(delta) / entry` relies on standard signed integer division, which truncates towards zero.
*   **Impact:** For positive returns, truncating down is conservative. However, for negative portfolio PnL, division truncates towards zero (e.g., `-5 / 2 = -2`), under-reporting the loss. This can make insolvent portfolios appear solvent, delaying critical liquidations and exposing the vault to bad debt.
*   **Remediation Blueprint:** Implement floor division (rounding towards negative infinity) for negative numerators:
    ```rust
    let quotient = numerator / denominator;
    let remainder = numerator % denominator;
    let adjusted = if (numerator ^ denominator).is_negative() && !remainder.is_zero() { quotient - 1 } else { quotient };
    ```

### ATRIUM-HIGH-02: Centralized Multisig Timelock Bypass in Aqueduct Resumption
*   **Coordinate:** `contracts/aqueduct/src/Aqueduct.sol:L181-184`
*   **Logical Vulnerability:** The `resume()` method uses the `onlyPraetor` (direct multisig) modifier instead of `onlyTimelock`.
*   **Impact:** Emergency pauses should be instant, but resuming operations is a parameter change that should require the Timelock. A compromised multisig could instantly resume a paused, exploited bridge and allow the attacker to continue draining assets before the community has a chance to veto.
*   **Remediation Blueprint:** Restrict bridge resumption exclusively to the 48-hour timelock controller:
    ```solidity
    function resume() external onlyTimelock { ... }
    ```

### ATRIUM-HIGH-03: Pause State Bypass in `queue_liquidation` Leads to Permanent Bad Debt
*   **Coordinate:** `contracts/vigil/src/lib.rs:L223-264`
*   **Logical Vulnerability:** `queue_liquidation` in the Vigil contract does not assert the contract's `is_paused` status.
*   **Impact:** Under-collateralized positions can still be queued during contract pauses, and their liquidation timers will immediately start counting down. If the pause outlasts the short liquidation window (30 blocks / ~2 minutes), these jobs will expire. Once the system is unpaused, they will fail with `JobExpired`, preventing liquidation and leaving the system with permanent bad debt.
*   **Remediation Blueprint:** Add a pause check to the queuing entry point:
    ```rust
    if self.is_paused.get() { return Err(VigilError::Paused(VigilPaused {})); }
    ```

### ATRIUM-HIGH-04: Approved Adapters Bypass Coffer Vault Global Withdrawal Pauses
*   **Coordinate:** `contracts/coffer/src/lib.rs:L539-623`
*   **Logical Vulnerability:** The `adapter_pull` logic bypasses checks for `is_withdrawals_paused`.
*   **Impact:** In the event of a security exploit, pausing withdrawals globally will not stop withdrawals initiated through approved adapters. If an adapter is compromised or behaves unexpectedly, it can still drain Coffer's USDC reserves.
*   **Remediation Blueprint:** Ensure all adapter withdrawal routes respect the pause status:
    ```rust
    if self.is_withdrawals_paused.get() { return Err(CofferError::WithdrawalsPaused(WithdrawalsPausedError {})); }
    ```

### ATRIUM-HIGH-05: Unauthenticated API Routes Leaking Wallet Balances & Inboxes
*   **Coordinate:** `apps/verify/src/app/api/transfer/*` & `apps/verify/src/app/api/notifications/route.ts`
*   **Logical Vulnerability:** Endpoints accept a `wallet` query parameter and return historical records, quotes, active balances, and inboxes with no SIWE session validation.
*   **Impact:** Critical leak of user privacy and PII. Anyone can query active holdings, transactions, and liquidation warnings for any wallet address, enabling targeted scraping or front-running strategies.
*   **Remediation Blueprint:** Integrate session-checking helpers on all sensitive user endpoints:
    ```typescript
    const session = await getSession(req);
    if (!session || session.walletAddress.toLowerCase() !== reqWallet.toLowerCase()) return new Response("Unauthorized", { status: 401 });
    ```

### ATRIUM-HIGH-06: Unauthenticated Active Mandate Disclosure
*   **Coordinate:** `apps/verify/src/app/api/agents/my-mandates/route.ts:44-52`
*   **Logical Vulnerability:** Discloses active, non-revoked Sigil mandates for any wallet via a simple `?wallet=0x...` query without validating ownership.
*   **Impact:** Leaks delicate delegation parameters and trading limit allocations of high-net-worth portfolios.
*   **Remediation Blueprint:** Enforce wallet signature session validation.

### ATRIUM-HIGH-07: Pagination Caps in Notifier Tick Loop Cause Silent Alert Loss
*   **Coordinate:** `services/notifier/src/tick.ts:94-103`
*   **Logical Vulnerability:** Subgraph/Scribe queries in the tick loop cap event retrieval to `first: 100`.
*   **Impact:** Under volatile market conditions, a single block can easily contain more than 100 liquidation or alert events. Capping the query to 100 and advancing the processed block cursor to `N` means any remaining events in block `N` are **permanently and silently ignored**. Users will not receive critical liquidation warnings.
*   **Remediation Blueprint:** Paginate through all events in a block using cursors, rather than capping queries with static limits.

### ATRIUM-HIGH-08: Pagination Caps Omit Depositors from Proof-of-Reserves Merkle Trees
*   **Coordinate:** `services/lantern-attestor/src/scribe.ts:14-22`
*   **Logical Vulnerability:** Merkle tree leaves are constructed by querying active balances with a static cap of `first: 1000`.
*   **Impact:** Once the Atrium depositor base exceeds 1000 active accounts, all users past the first 1000 will be omitted from the Merkle tree. Their balances will not be factored into the published reserves root, causing their on-chain inclusion proofs to **fail** and breaking the protocol's Proof-of-Reserves guarantee.
*   **Remediation Blueprint:** Implement recursive query pagination to fetch all active balances:
    ```typescript
    while (hasMore) {
       const page = await fetchBalances(skip, PAGE_SIZE);
       allBalances.push(...page);
       if (page.length < PAGE_SIZE) hasMore = false; else skip += PAGE_SIZE;
    }
    ```

### ATRIUM-HIGH-09: Capped Trade History Queries Generate Corrupt Tax Filings
*   **Coordinate:** `services/tablet/src/scribe_client.py:41-51`
*   **Logical Vulnerability:** The tax calculation engine caps yearly position queries to `first: 1000` records.
*   **Impact:** Active traders exceeding 1000 transactions per year will have their trade histories silently truncated. The resulting capital gains and wash-sale reports will be highly inaccurate, exposing users to serious tax compliance liabilities.
*   **Remediation Blueprint:** Implement query pagination in Scribe clients to retrieve complete trade histories.

### ATRIUM-HIGH-10: Lack of USD-EUR FX Conversion in German FIFO Reports
*   **Coordinate:** `services/tablet/src/jurisdictions/de.py:79-80`
*   **Logical Vulnerability:** The German tax module assumes that trade prices (stored on-chain in USD) are already in EUR, assuming a 1:1 parity.
*   **Impact:** German users will receive tax reports with incorrect FIFO Spekulationsfrist capital gains calculations.
*   **Remediation Blueprint:** Fetch and apply historical USD-to-EUR exchange rates for the exact trade timestamps:
    ```python
    rate_eur = get_usd_to_eur_rate(t.timestamp.date().isoformat())
    t.price_eur = t.price * rate_eur
    ```

### ATRIUM-HIGH-11: Lack of USD-GBP FX Conversion in UK CGT Reports
*   **Coordinate:** `services/tablet/src/jurisdictions/uk.py:113-117`
*   **Logical Vulnerability:** The s.104 UK Capital Gains Tax calculator processes USD-denominated trade logs directly and writes them unconverted into HMRC SA108 CSV cells explicitly labeled "GBP".
*   **Impact:** Renders exported UK tax documents invalid due to incorrect currency calculations.
*   **Remediation Blueprint:** Integrate a daily USD-to-GBP exchange rate conversion layer.

### ATRIUM-HIGH-12: Broken Integration on Tax Export Route
*   **Coordinate:** `apps/verify/src/app/api/tax/export/route.ts:37-41`
*   **Logical Vulnerability:** The Next.js export endpoint fails to supply mandatory query parameters (`address`, `tax_year_start`, and `tax_year_end`) required by the downstream Python Tablet service.
*   **Impact:** Clicking the tax export button in the UI always fails, returning a 422 error from Tablet and a 503 error to the client.
*   **Remediation Blueprint:** Resolve the active parameters before calling Tablet:
    ```typescript
    const params = new URLSearchParams({ address: session.walletAddress, jurisdiction, tax_year_start: `${year}-01-01`, tax_year_end: `${year}-12-31`, format });
    ```

### ATRIUM-HIGH-13: Broken Integration on Tax Summary and Events API Routes
*   **Coordinate:** `apps/verify/src/app/api/tax/summary/route.ts` & `api/tax/events/route.ts`
*   **Logical Vulnerability:** Next.js routes query the `/summary` and `/events` endpoints on the Tablet service. However, the Python Tablet service defines **neither of these paths**.
*   **Impact:** Calls to these endpoints always fail with a 404 error, preventing the UI from displaying real tax summaries.
*   **Remediation Blueprint:** Implement the missing `/summary` and `/events` routes within the Python Tablet service (`main.py`).

### ATRIUM-HIGH-14: Hardcoded Mock Statistics Masquerading as Live Data
*   **Coordinate:** `apps/verify/src/components/atrium/mobile/MobileLanding.tsx` & `MobileApp.tsx`
*   **Logical Vulnerability:** Static placeholder metrics representing buying power, collateral ratios, total live TVL, active agents, and transaction feeds are hardcoded across mobile pages.
*   **Impact:** Directly violates the protocol's live-data rules, displaying fake metrics under a "live on-chain" banner.
*   **Remediation Blueprint:** Wire the mobile components to the real react-query data hooks used in the desktop version, and render skeleton shimmers during loading.

### ATRIUM-HIGH-15: Broken Docker Build Context
*   **Coordinate:** `.dockerignore:L84-86`
*   **Logical Vulnerability:** The workspace root `.dockerignore` excludes `agents/` and `services/` directories.
*   **Impact:** The `agents/Dockerfile` runs from the workspace root and copies these ignored folders. During CI/CD or deployment builds, the build context fails with a `COPY failed` error.
*   **Remediation Blueprint:** Remove `agents/` and `services/` from the root `.dockerignore` so they are correctly included in the build context.

### ATRIUM-HIGH-16: Missing Workflow Concurrency Controls Cause KV and Nonce Collisions
*   **Coordinate:** `notifier-cron.yml`, `lantern-cron.yml`, and `vigil-keeper.yml`
*   **Logical Vulnerability:** Scheduled workflows have no `concurrency` groups configured.
*   **Impact:** If a runner delays, multiple runs of the same cron will execute concurrently. This causes race conditions on the notifier's KV store cursor and transaction/nonce collisions on the keeper's private key EOA, resulting in failed transactions and missed liquidations.
*   **Remediation Blueprint:** Configure a unique concurrency group for each workflow:
    ```yaml
    concurrency:
      group: ${{ github.workflow }}
      cancel-in-progress: true
    ```

---

## 🟡 V. MEDIUM SEVERITY FINDINGS

### ATRIUM-MED-01: Initialization Front-Running Window in Stylus Deployments
*   **Coordinate:** `contracts/vigil/src/lib.rs:L182-220`, `coffer/src/lib.rs:L177-211`, and `sigil/src/lib.rs:L149-191`
*   **Logical Vulnerability:** Contracts rely on public `initialize()` functions instead of atomic constructors, allowing a front-running window between deployment and initialization.
*   **Impact:** Front-running bots can monitor the mempool, front-run the `initialize()` transaction, and claim admin privileges over the deployed contracts.
*   **Remediation Blueprint:** Migrate initialization logic into Stylus `#[constructor]` blocks, or restrict the `initialize()` function to only accept calls from the deployer address.

### ATRIUM-MED-02: Incomplete Chainlink `latestRoundData` Validation
*   **Coordinate:** `contracts/plinth-oracle/src/lib.rs:L101-103`
*   **Logical Vulnerability:** The `safe_price` function queries Chainlink's `latestRoundData` but ignores the returned `roundId` and `answeredInRound` values.
*   **Impact:** The system cannot detect when an oracle price comes from an uncompleted or stale round, exposing the protocol to incorrect price feeds.
*   **Remediation Blueprint:** Validate that `answeredInRound >= roundId`:
    ```rust
    let (cl_round_id, cl_answer, _, cl_updated, cl_answered_in_round) = chainlink.latest_round_data(self.vm(), Call::new()).unwrap();
    if cl_answered_in_round < cl_round_id { return Err(OracleError::code(ERR_STALE)); }
    ```

### ATRIUM-MED-03: Aave Liquidity Shortfall Strands User Collateral in Adapter
*   **Coordinate:** `contracts/adapters/aave-horizon/src/AaveHorizonAdapter.sol:L181-182`
*   **Logical Vulnerability:** The adapter requests a withdrawal of `pos.supplied_amount` from Aave. If Aave's reserve lacks sufficient liquidity, it returns the actual lower amount withdrawn, but the adapter proceeds to calculate a false loss and delete the position.
*   **Impact:** The user loses their collateral, and Plinth absorbs bad debt, even though the funds are still technically in Aave.
*   **Remediation Blueprint:** Assert that the withdrawn amount exactly matches the requested supplied amount:
    ```solidity
    uint256 withdrawn = pool.withdraw(usdc, pos.supplied_amount, atrium_coffer);
    if (withdrawn < pos.supplied_amount) revert InsufficientAaveLiquidity();
    ```

### ATRIUM-MED-04: Chaos Injection Rate Limiters Reset on Serverless Cold Starts
*   **Coordinate:** `apps/verify/src/app/api/chaos/inject/route.ts:96-131`
*   **Logical Vulnerability:** Rate limiters for chaos drills are stored in local in-memory Maps instead of a persistent database.
*   **Impact:** Serverless functions (Vercel) spin up new containers frequently. Attackers can bypass the rate limits on subsequent cold starts and spam chaos endpoints to drain the keeper's gas budget.
*   **Remediation Blueprint:** Move rate limiting states to a persistent store like Upstash Redis.

### ATRIUM-MED-05: Extreme 1-Minute Cron Frequency Exhausts GitHub Actions Quota
*   **Coordinate:** `notifier-cron.yml:L11`
*   **Logical Vulnerability:** The notifier cron is configured to run every single minute (`* * * * *`).
*   **Impact:** Running a job every minute translates to 1,440 build minutes per day, fully exhausting a standard GitHub account's free 2,000-minute quota in under 33 hours and stalling all repository pipelines.
*   **Remediation Blueprint:** Migrate the notifier service off GitHub Actions to run as a persistent lightweight daemon on a VPS (using Fly.io or DigitalOcean).

### ATRIUM-MED-06: Missing Step/Job Timeouts in CI Actions
*   **Coordinate:** `.github/workflows/ci.yml`
*   **Logical Vulnerability:** No jobs in the primary CI pipeline specify a `timeout-minutes` value, defaulting to the 6-hour GitHub Actions cap.
*   **Impact:** If a test hangs or runs into an infinite loop, the job will consume quota minutes for up to 6 hours.
*   **Remediation Blueprint:** Set explicit job-level timeouts (e.g. `timeout-minutes: 15`).

### ATRIUM-MED-07: Silent Failures and Incomplete Alerting for Critical Daemon Tasks
*   **Coordinate:** `agents-cron.yml`, `notifier-cron.yml`, and `vigil-keeper.yml`
*   **Logical Vulnerability:** Critical workflows run without failure notification steps.
*   **Impact:** If the keeper or notifier fails silently, the protocol will run blind without alerts or liquidation executions, and developers will not be notified of the outage.
*   **Remediation Blueprint:** Add a failure notification step to post alerts to a Discord operations webhook:
    ```yaml
    - name: Notify ops on failure
      if: failure()
      run: curl -X POST -H 'Content-Type: application/json' -d '{"content":"🚨 Job FAILED"}' $DISCORD_OPS_WEBHOOK
    ```

### ATRIUM-MED-08: Standard `Loader2` Spinners Violate UI Visual Conventions
*   **Coordinate:** `apps/verify/src/components/verifier-step-runner.tsx:L74` & `L243`
*   **Logical Vulnerability:** Interactive loading states render rotating SVG spinner components instead of standard custom skeleton shimmers.
*   **Impact:** Violates the "skeleton shimmers, never spinners" design convention in `ui.md`.
*   **Remediation Blueprint:** Replace the spinner components with custom horizontal skeleton shimmers.

### ATRIUM-MED-09: Inline OKLCH Style Pollution Bypasses CSS Variables
*   **Coordinate:** `apps/verify/src/app/app/portfolio/page.tsx` & `page.tsx`
*   **Logical Vulnerability:** Multiple components define color properties using raw inline OKLCH values instead of standard theme variables.
*   **Impact:** Bypasses the unified theme framework, cluttering the code and preventing centralized style updates.
*   **Remediation Blueprint:** Extract inline colors into standard CSS variable utility classes.

### ATRIUM-MED-10: Incomplete Error States in Leaderboard Data Fetching
*   **Coordinate:** `apps/verify/src/components/agents/leaderboard.tsx:L23-31`
*   **Logical Vulnerability:** The data-fetching `catch` block silences loading errors and returns an empty list.
*   **Impact:** Bypasses error states by hiding fetch failures under the guise of an empty board, rather than displaying an error message with a retry option.
*   **Remediation Blueprint:** Let the query hook capture the error state and display a fallback card with a "Try Again" refresh button.

---

## 🛠️ VI. COMPLETE REMEDIATION BLUEPRINT

### 1. Fix plinth-math Array Mismatch (Stylus - Rust)
Open `contracts/plinth-math/src/lib.rs:L60` and replace the zero-return safety block with a proper revert error:
```rust
// contracts/plinth-math/src/lib.rs
sol! {
    error ArrayLengthMismatch();
}

pub fn required_margin(
    notionals: Vec<I256>,
    entry_prices_q64: Vec<U256>,
    current_prices_q64: Vec<U256>,
    haircuts_bps: Vec<U256>,
    correlation_classes: Vec<U256>,
) -> Result<U256, PlinthMathError> {
    let n = notionals.len();
    if n == 0
        || entry_prices_q64.len() != n
        || current_prices_q64.len() != n
        || haircuts_bps.len() != n
        || correlation_classes.len() != n
    {
        return Err(PlinthMathError::Revert(ArrayLengthMismatch {}));
    }
    // ... rest of margin calculation
}
```

### 2. Secure Notifier Webhooks Against SSRF & Slowloris attacks (TypeScript)
Modify `services/notifier/src/channels/webhook.ts` to implement IP validation and a strict fetch timeout:
```typescript
// services/notifier/src/channels/webhook.ts
import type { Alert, ChannelConfig } from '../types.js';
import { dns } from 'node:dns/promises';
import { isIP } from 'node:net';

const WEBHOOK_TIMEOUT_MS = 8000;

export async function deliverWebhook(alert: Alert, config: ChannelConfig): Promise<void> {
  const url = new URL(config.customWebhookUrl);
  if (url.protocol !== 'https:') throw new Error('HTTPS required');

  const ips = isIP(url.hostname) ? [url.hostname] : await dns.resolve(url.hostname);
  for (const ip of ips) {
    if (isPrivateOrLoopback(ip)) throw new Error(`Forbidden target IP: ${ip}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const r = await fetch(config.customWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: 'atrium-alert-v1', alert }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`Webhook failed: ${r.status}`);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function isPrivateOrLoopback(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '169.254.169.254') return true;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}
```

### 3. Add SIWE Session Guards to API Endpoints (Next.js - TypeScript)
Secure all sensitive data endpoints in `apps/verify/src/app/api/` by validating the requester's wallet address against their active session:
```typescript
// apps/verify/src/app/api/transfer/recent/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export async function GET(req: Request) {
  const session = await getSession(req);
  const walletParam = new URL(req.url).searchParams.get('wallet');

  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'unauthorized', detail: 'active login required' }, { status: 401 });
  }

  const requestedWallet = (walletParam ?? session.walletAddress).toLowerCase();
  if (session.walletAddress.toLowerCase() !== requestedWallet) {
    return NextResponse.json({ error: 'forbidden', detail: 'access denied' }, { status: 403 });
  }

  // Fetch recent transfers securely...
}
```

### 4. Implement Dynamic Historical FX Conversion inside Tax Services (Python)
Integrate daily exchange rates in `services/tablet/src/jurisdictions/de.py` instead of assuming 1:1 USD parity:
```python
# services/tablet/src/jurisdictions/de.py
from ..fx_rates import get_usd_to_eur_rate

def calculate_de_fifo(trades: Iterable[Trade]) -> DeFifoReport:
    trades = sorted(trades, key=lambda t: t.timestamp)
    pools = {}
    report = DeFifoReport()

    for t in trades:
        rate_eur = get_usd_to_eur_rate(t.timestamp.date().isoformat())
        if t.side == "buy":
            t.price_eur = t.price * rate_eur
            pools.setdefault((t.venue_id, t.instrument_id), deque()).append(t)
            continue
            
        # FIFO matching...
        # cost_basis_eur = match_qty * front.price_eur
        # proceeds_eur = match_qty * t.price * rate_eur
```

### 5. Secure GHA Shell Interpolation and Set Concurrency Groups (YAML)
Rewrite `.github/workflows/archive-weekly.yml` to prevent shell injection, and set explicit concurrency limits:
```yaml
# .github/workflows/archive-weekly.yml
name: Weekly Backtest
on:
  workflow_dispatch:
    inputs:
      strategy:
        description: 'Strategy id'
        default: 'mean-reversion-v1'

concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true

jobs:
  run-backtest:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - name: Run loop
        env:
          INPUT_STRATEGY: ${{ github.event.inputs.strategy }}
        run: |
          python -m services.archive.src.research_loop --strategy "${INPUT_STRATEGY:-mean-reversion-v1}"
```

---

## ⚖️ VII. THE RUTHLESS COFOUNDER VERDICT

Atrium possesses the foundational architecture to compete as a premier decentralized prime brokerage platform. The Stylus smart contracts are optimized for speed, the visual design is beautifully distinct, and the unified portfolio margin design is mathematically sound.

However, the current testnet build contains **critical compromises**. Releasing a platform where user PII can be harvested without login, where a paused liquidation contract leads to permanent bad debt, where proof-of-reserves fail past the first 1000 users, and where tax reports assume 1:1 currency parities would ruin Atrium's professional reputation. 

**This codebase is NOT ready for mainnet or public launch.** 

### Immediate Action Plan
1. **Apply the typographic fix (ATRIUM-CRT-03) and touch-target fixes (ATRIUM-CRT-04, 05) immediately.**
2. **Apply the Plinth math check (ATRIUM-CRT-01) and security fixes (ATRIUM-CRT-02, 06).**
3. **Establish API session checks across all frontend routes (ATRIUM-HIGH-05).**
4. **Remove hardcoded limits (`first: 1000`) and replace them with recursive pagination to prevent silent data loss.**
5. **Implement daily exchange rate conversions within the UK and German tax calculators.**

Executing these fixes will elevate Atrium from a compromised testnet prototype into an elite, bulletproof prime brokerage platform.
