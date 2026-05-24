# Atrium Launch Runbook

**Purpose:** turn every `human_left.md` operational item into a copy-paste-and-execute step. The code is shipped; this is the script the F-team runs.

**Owner:** F1 (deploys), F2 (frontend deploys), F3 (BD + ops). Each step below names its owner + estimated wall-clock minutes.

---

## Day −7 to Day −3 (pre-Buildathon prep)

### Step 1 — Linux Stylus build seat (`human_left.md` #11) · F1 · 30 min

```bash
# From a Linux machine (or WSL on Windows):
docker build -t atrium-stylus -f contracts/stylus.Dockerfile .
./scripts/stylus-check.sh all   # runs cargo stylus check on all 4 Stylus crates
```

Verifies the Stylus source edits FIRE78-PLINTH-H1 + FIRE78-COF1 compile cleanly. Expected output: 4 successful `cargo stylus check` runs, no errors.

### Step 2 — Hardware wallet setup (`human_left.md` #2) · F1, F2, F3 · 60 min × 3

Each founder:
1. Plug in Ledger or Trezor (Ledger preferred — better Stylus support).
2. Visit `safe.global/welcome` on Arbitrum Sepolia.
3. Create 3-of-5 Safe with the 5 founder addresses (F1, F2, F3, plus 2 trusted advisors per `security.md`).
4. Record Safe address in `deploy/multisig.txt` (gitignored).

Test signature: have each founder sign a no-op tx (e.g., wrap+unwrap 0.01 testnet ETH). Confirms the hardware wallet chain works before real deploys.

### Step 3 — Validator key material (`human_left.md` #18) · F1 · 45 min

```bash
# Lantern attestor signing key (Argon2id-encrypted on VPS)
openssl rand -hex 32 > /tmp/lantern-signing.key
# Encrypt with passphrase
age -p < /tmp/lantern-signing.key > deploy/lantern-signing.key.age
rm /tmp/lantern-signing.key

# Codex HMAC key
openssl rand -hex 32 > deploy/codex-hmac.key.tmp
# Upload to Cloudflare Workers secret (must be done via wrangler)
cd services/codex && wrangler secret put CODEX_HMAC_KEY < ../../deploy/codex-hmac.key.tmp
rm deploy/codex-hmac.key.tmp
```

### Step 4 — Sumsub sandbox onboarding (`human_left.md` #8) · F3 · 30 min

1. Go to `sumsub.com/signup` → create sandbox account (free tier).
2. Dashboard → API → create webhook → URL: `https://codex.atrium.fi/sumsub/callback`.
3. Copy webhook secret into Cloudflare:
   ```bash
   cd services/codex && wrangler secret put SUMSUB_WEBHOOK_SECRET
   ```
4. Update `deploy/edict-sumsub-verifier.txt` with the Sumsub-issued verifier address (`Edict.assignTier` allow-list).

### Step 5 — Cohort partner outreach (`human_left.md` #4) · F3 · 120 min

Template at `ops/outreach/cohort-email-template.md`. Send to all targets in `outreach/targets-private.md` (gitignored — `human_left.md` rule).

Expected response rate: 1–3 of 5–8 partners by Day 17 per PRD §17 Day-180 metric.

---

## Day −2 to Day −1 (contract deploy)

### Step 6 — Praetor CLI deploy chain · F1 · 60 min

```bash
# Set env
export ARBITRUM_SEPOLIA_RPC_URL=<your-sepolia-rpc>
export SEPOLIA_DEPLOYER_KEY=<your-deployer-key>   # NOT a founder hardware wallet — disposable EOA for initial deploys

# Run waves (Wave 1 → 2 → 3 → 4)
cd services/praetor-cli && cargo run -- deploy --network arbitrum_sepolia --all
```

Writes `deploy/arbitrum-sepolia.json` with every contract address.

### Step 7 — Post-deploy wiring via multisig · F1+F2+F3 · 90 min

Each `cast send` below is wrapped into a Safe tx; 3-of-5 sign.

```bash
# Coffer adds AtriumRouter to approved adapters
cast send <coffer> "set_adapter(address,bool,uint256)" <router> true 1000000000000
# Each adapter adds Router to authorized callers
cast send <curve-adapter> "setAuthorizedCaller(address,bool)" <router> true
# ... repeat for Pendle, TradeXyz, Polymarket, Hyperliquid, AaveV11

# PorticoRegistry registers every adapter
cast send <portico-registry> "registerAdapter(uint8,address,bytes32,uint256)" 1 <curve-adapter> <curve-codehash> 1
# ... etc.

# Each onlyTimelock setter goes through the 48h timelock — schedule them now
# so they're ready for Day 17 launch.
```

Save all tx hashes into `ops/deploy-tx-hashes.txt`.

### Step 8 — Subgraph deploy · F1 · 15 min

```bash
./scripts/subgraph-deploy.sh
```

Pre-req: `deploy/arbitrum-sepolia.json` from Step 6.

### Step 9 — Codex + Lantern deploy · F1 · 30 min

```bash
cd services/codex && pnpm migrate && wrangler deploy
cd services/lantern-attestor && fly deploy   # or your VPS deploy target
```

### Step 10 — Frontend deploy · F2 · 15 min

```bash
cd apps/verify && pnpm build && vercel deploy --prod
```

---

## Day 0 (launch day, June 10 if Buildathon submission)

### Step 11 — Demo dress rehearsal #10 (`human_left.md` #7) · F1+F2+F3 · 30 min

Use `ops/rehearsal-script.md`. Time it — must finish in ≤6 minutes per PRD §26.2. Inject a Chaos Mode fault at random; recovery must finish within the 6-min budget.

### Step 12 — Loom backup video (`human_left.md` #20) · F2 · 60 min

1. Record full 5-min Verifier flow on Sepolia.
2. Upload to Loom (or self-host on Vercel).
3. Generate QR pointing at the URL.
4. Print QR on the laptop sticker; test by turning off WiFi during a dry-run.

### Step 13 — Code4rena public listing (`human_left.md` #10 supplement) · F3 · 45 min

1. Go to `code4rena.com/start` → submit Atrium for warden marketplace.
2. Bundle: `code4rena/submission-pack/` (already drafted — Step 14).
3. $20K reward pool from Open House London prize (if it lands per PRD §17).

### Step 14 — Stanford Law Crypto Clinic consult (`human_left.md` #5) · F3 · 30 min

Booking form at `https://law.stanford.edu/codex/legal-clinic/`. Ask the questions in `ops/legal-consult-questions.md`. Save the resulting memo as `legal/jurisdictional-note-v1.pdf` (gitignored).

### Step 15 — Press outreach (`human_left.md` #9) · F3 · 45 min

Template at `ops/outreach/press-one-pager.md`. Sequence: The Defiant first (founder warm intro), Decrypt second, The Block third. Don't send all at once — wait for replies.

### Step 16 — Social announcement · F1+F2+F3 · 15 min

Three posts: X, Farcaster, Mirror. Templates at `ops/social-announcements.md`. Coordinate so the three founders amplify each other.

---

## Day 1+ (post-launch monitoring)

### Step 17 — Continuous monitoring · F1 · daily

```bash
# Check the deployed Lantern is publishing hourly
curl https://codex.atrium.fi/v1/attestation/latest

# Check Verifier Mode is reachable
curl -I https://verify.atrium.fi

# Check Kani badge is current
curl https://verify.atrium.fi/kani-status.json
```

Alert on any of:
- Lantern doesn't publish in 90 minutes
- LinkBalanceLow event fires
- ChaosMode page error
- Cohort partner count regresses

### Step 18 — Weekly cohort partner check-ins · F3 · 30 min/week

Email each partner: "are you still in?" Update `cohort.atrium.fi` Scribe-backed live count if any churn.

---

## Tripwires

If any of the following happen, halt + announce per PRD §26.3:

- **Audit HIGH finding from Code4rena public listing** → schedule fix wave + delay any feature merges
- **Kani CI badge goes red** → block testnet announcements until green
- **Lantern offline > 4h** → publish status note on `status.atrium.fi`
- **Founder burnout signal** → take 7-day rest; PRD §26.3 explicitly allows this

---

## Sign-off

| Item | Status | Owner | Done date |
|---|---|---|---|
| Step 1 Linux Stylus build | | F1 | |
| Step 2 Hardware wallets + Safe | | All | |
| Step 3 Validator keys | | F1 | |
| Step 4 Sumsub | | F3 | |
| Step 5 Cohort outreach R1 | | F3 | |
| Step 6 Contract deploy | | F1 | |
| Step 7 Post-deploy wiring | | All | |
| Step 8 Subgraph | | F1 | |
| Step 9 Codex + Lantern | | F1 | |
| Step 10 Frontend | | F2 | |
| Step 11 Demo rehearsal #10 | | All | |
| Step 12 Loom backup | | F2 | |
| Step 13 Code4rena listing | | F3 | |
| Step 14 Legal consult | | F3 | |
| Step 15 Press outreach | | F3 | |
| Step 16 Social announce | | All | |

**Sign here when complete:** `_________________ (F1) _________________ (F2) _________________ (F3)`
