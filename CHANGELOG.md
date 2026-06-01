# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added
- Phase 0: Doppler config templates, deployer key rotation runbook, Student Pack signup checklist
- Phase 1: Honest landing page (deleted Lovable-port fake stats), generated docs/deployment.md from registry
- Phase 2: Critical contract fixes (PlinthMath revert, Aqueduct timelock, Vigil pause gate, Coffer reentrancy)
- Phase 3: Subgraph completeness (Rostrum + eight event handlers), Vigil keeper service
- Phase 4: ResearchAttestation + Edict tier registry, off-chain notification channels
- Phase 5: Brand system (design tokens, OG images, favicon, /brand page), writing conventions
- Phase 6: Mobile-app canon parity with desktop verifier, responsive audit
- Phase 7: Legal pages (terms, privacy, KYC, sub-processors), accessibility statement, cookie consent
- Phase 8: Security hardening (SIWE auth, SSRF guard, rate limiting, CSP headers)
- Phase 9: CI hardening (SHA-pinned actions, Kani regression gate, Lighthouse CI, gitleaks)
- Phase 10: Status page, SLA page, security bounty page, hall-of-fame, BrowserStack setup
- Phase 11: PWA icons + service worker + install prompt, CHANGELOG.md, press kit, banned-words CI gate
- Phase 12: Observability (New Relic, Honeybadger heartbeats, Sentry tags), beta feedback, incident-response runbook

### Changed
- Lantern attestation cadence aligned to 10 minutes (was inconsistent hourly)
- CODEOWNERS expanded with coverage for audits/, incidents/, docs/, Makefile, docker-compose
- PR template enhanced with ABI-change and findings-closed checklist items
- Deployment doc generator adds Sourcify verification column

### Removed
- Lovable-port fake-data components: Numbers.tsx, MobileLanding.tsx, MobileApp.tsx, Features.tsx, DesktopApp.tsx, mock.ts
- bash.exe.stackdump (repo hygiene)

### Fixed
- PlinthMath overflow on extreme leverage scenarios
- Aqueduct CCIP replay protection edge case on reorgs
- Vigil pause gate respects both multisig and timelock callers
- Coffer vault share calculation rounding (favor protocol)

### Security
- SSRF guard on notifier webhook delivery
- SIWE session auth on user-data routes
- Workflow hardening (permissions, timeouts, SHA pins, failure notifications)
- CSP headers with nonce-based script loading
- Rate limiting on all public API routes

## v0.2.1 (2026-05-25)

### Fixed
- Closed every code-doable item from post-launch contract + integration audit
- Coffer, Plinth, Sigil, and Vigil reentrancy guards made consistent
- Selector-mismatch class regression-tested against deployed ABIs
- Faucet drain functions guard against zero-address recipients

## v0.2.0 (2026-05-25)

### Added
- Subgraph completeness (Rostrum + eight event handlers)
- Vigil keeper goes live as a scheduled service
- ResearchAttestation + Edict tier registry orchestrators
- Off-chain notification channels (Telegram, Discord, email, webhook)
- Mobile-app reaches canon parity with desktop verifier
- Code4rena audit pack assembled

## v0.1.0 (2026-05-23)

### Added
- LanternAttestor proof-of-reserves cron with on-chain publish
- Validator-set bootstrap for Hyperliquid + Polymarket adapters
- MockAavePool deployed to bridge Aave Horizon on testnet
- Chaos Mode wired to real multisig pause/restore
- Praetor CLI gains lantern publish-now + seed pre-flight
- Loadtest baselines via k6

## pre-v0.1 (2026-05-18)

### Added
- Verifier-mode UI complete with deployment-readiness banners and live Kani CI badge
- Plinth SPAN compute and dual-oracle median path
- Sigil EIP-712 with on-chain ecrecover via precompile 0x01
- Aqueduct CCIP with reorg-safe replay protection and claim-back path
- All adapters migrated to explicit-originator pattern (no `tx.origin`)
