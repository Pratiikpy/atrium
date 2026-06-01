.PHONY: help demo install contracts test kani frontend subgraph deploy audit lint clean deployment-doc banned-words press-kit

# Default target: short help
help:
	@echo "Atrium build commands:"
	@echo "  make demo        Run full local stack in ~90s (deploys to local Sepolia fork)"
	@echo "  make install     Install all deps (pnpm + cargo + foundry)"
	@echo "  make contracts   Build all Stylus + Solidity contracts"
	@echo "  make test        Run all test suites"
	@echo "  make kani        Run Kani formal verification proofs"
	@echo "  make frontend    Build Next.js apps"
	@echo "  make subgraph    Build subgraph"
	@echo "  make deploy      Deploy to Sepolia (requires Praetor multisig)"
	@echo "  make audit       Run static analysis + linters"
	@echo "  make lint        Format check + clippy + solhint"
	@echo "  make clean       Remove all build artifacts"

# Demo: spin up local Sepolia fork, deploy contracts, seed data, open browser
# Target: complete in ≤90 seconds on a fresh clone (per PRD §22.2 patch 12)
demo:
	@echo "==> Atrium demo: starting local stack"
	@command -v anvil >/dev/null 2>&1 || { echo "Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash"; exit 1; }
	@command -v cargo >/dev/null 2>&1 || { echo "Cargo not installed. Visit https://rustup.rs"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm not installed. Run: npm install -g pnpm"; exit 1; }
	@echo "==> Starting Anvil (forked Arbitrum Sepolia)..."
	@anvil --fork-url ${ARBITRUM_SEPOLIA_RPC_URL:-https://arbitrum-sepolia.publicnode.com} --port 8545 --chain-id 421614 > /tmp/anvil.log 2>&1 &
	@sleep 3
	@echo "==> Deploying contracts..."
	@$(MAKE) deploy-local
	@echo "==> Seeding test data..."
	@$(MAKE) seed-local
	@echo "==> Launching Verifier Mode..."
	@cd apps/verify && pnpm dev &
	@sleep 5
	@(which xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3000) || (which open >/dev/null 2>&1 && open http://localhost:3000) || (which start >/dev/null 2>&1 && start http://localhost:3000) || echo "Open http://localhost:3000 manually"
	@echo "==> Demo running. Stop with: pkill -f anvil && pkill -f 'pnpm dev'"

# demo-frontend: Verifier UI only, no local-fork contracts. Audit L-C3 fix.
# Works on Windows MSVC where Stylus contract builds are blocked (human_left.md #11).
# Points apps/verify at the deployed Sepolia contracts (deployments/arbitrum_sepolia.json);
# the Verifier step runner shows "Step not wired yet" honestly for any step whose
# contract address is still 0x0.
demo-frontend:
	@echo "==> Atrium frontend-only demo (no local contract deploy)"
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm not installed. Run: npm install -g pnpm"; exit 1; }
	@cd apps/verify && pnpm install --frozen-lockfile
	@cd apps/verify && pnpm dev &
	@sleep 5
	@(which xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3000) || (which open >/dev/null 2>&1 && open http://localhost:3000) || (which start >/dev/null 2>&1 && start http://localhost:3000) || echo "Open http://localhost:3000 manually"
	@echo "==> Frontend demo running on http://localhost:3000, Verifier shows live deployment status per step"

install:
	@echo "==> Installing dependencies"
	pnpm install
	cargo fetch
	@echo "==> Done. Run 'make demo' to start."

contracts:
	@echo "==> Building Stylus contracts"
	cd contracts/plinth && cargo stylus check
	cd contracts/coffer && cargo stylus check
	cd contracts/vigil && cargo stylus check
	cd contracts/sigil && cargo stylus check
	@echo "==> Building Solidity contracts"
	forge build

test:
	@echo "==> Running test suite"
	cargo test --workspace
	# Audit gap (#58): the Stylus crates' host tests are NOT run here. `cargo test`
	# per crate fails to link the cdylib (WasmVM host symbols) on a native target;
	# running them needs a Stylus TestVM harness (tracked with #24/#25).
	forge test -vvv
	pnpm -r test

kani:
	@echo "==> Running Kani formal verification"
	# Audit fix (#82): the prior `--harness solvency_invariant` etc. named
	# harnesses that do not exist (real names: solvency_non_negative,
	# oracle_freshness_rejects_stale, mandate_expiry_monotonic), so every line
	# exited non-zero. Drop --harness so each crate runs its full proof set,
	# matching .github/workflows/ci.yml and staying in sync if harnesses are renamed.
	cd contracts/plinth && cargo kani
	cd contracts/sigil && cargo kani
	@echo "==> All Kani proofs green"

frontend:
	pnpm --filter @atrium/verify build

subgraph:
	pnpm --filter @atrium/subgraph build

check-event-indexing:
	@echo "==> Asserting every contract event has a subgraph handler"
	node scripts/check-event-indexing.mjs

check-entity-writers:
	@echo "==> Asserting every subgraph entity has a writer"
	node scripts/check-entity-writers.mjs

deploy:
	@echo "==> Deploying via Praetor CLI (requires multisig signers)"
	cd services/praetor-cli && cargo run -- deploy --network arbitrum_sepolia --all

deploy-local:
	cd services/praetor-cli && cargo run -- deploy --network local --all

seed-local:
	cd services/praetor-cli && cargo run -- seed --network local

audit:
	@echo "==> Static analysis"
	forge build
	@command -v slither >/dev/null 2>&1 && slither contracts/ || echo "(slither not installed, skipping)"
	@command -v gitleaks >/dev/null 2>&1 && gitleaks detect --no-banner || echo "(gitleaks not installed, skipping)"

lint:
	cargo fmt --check
	cargo clippy --workspace -- -D warnings
	pnpm -r lint
	@command -v solhint >/dev/null 2>&1 && solhint 'contracts/**/*.sol' || echo "(solhint not installed, skipping)"

clean:
	cargo clean
	forge clean
	pnpm -r clean
	rm -rf node_modules .pnpm-store .turbo


deployment-doc:
	@echo "==> Regenerating docs/deployment.md from registry"
	node scripts/generate-deployment-doc.mjs

banned-words:
	@echo "==> Checking for banned marketing words"
	node scripts/check-banned-words.mjs

press-kit:
	@echo "==> Building press kit ZIP"
	node scripts/build-press-kit.mjs
