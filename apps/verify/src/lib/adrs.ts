/**
 * Architecture Decision Records, ADR-001 through ADR-012.
 *
 * Curated from docs/architecture-internal.md (the engineering TDD). ADRs are
 * public-appropriate by nature (they record why a decision was made, not
 * secrets), but rather than auto-publish a 2,300-line internal file we
 * transcribe just the 12 records here, so /docs/adr can never accidentally
 * surface adjacent internal-only content. Em-dashes from the source are
 * normalized to hyphens per the writing rules.
 */

export interface AdrSection {
  label: string;
  text: string;
}

export interface Adr {
  /** Zero-padded id, e.g. "001". */
  id: string;
  title: string;
  date?: string;
  sections: AdrSection[];
}

export const ADRS: Adr[] = [
  {
    id: '001',
    title: 'Stylus over pure Solidity for compute-heavy contracts (Plinth, Vigil, Coffer, Sigil)',
    date: '2026-05-10',
    sections: [
      { label: 'Context', text: 'SPAN margin computation is a nested loop. The Solidity equivalent is estimated at 10 to 100x more gas per the Arbitrum docs.' },
      { label: 'Decision', text: 'Plinth + Vigil + Coffer + Sigil in Rust + Stylus. Adapters, registries, and governance in Solidity.' },
      { label: 'Alternatives', text: 'All-Solidity (rejected: violates the gas goal). All-Stylus (rejected: the adapter ecosystem is Solidity-native; integration friction).' },
      { label: 'Consequences', text: 'The team must master both Rust and Solidity. The build pipeline is more complex (cargo stylus + Foundry). Worth it for the compute moat.' },
    ],
  },
  {
    id: '002',
    title: 'Kani + proptest, not Halmos, for formal verification',
    date: '2026-05-18',
    sections: [
      { label: 'Context', text: 'Earlier drafts cited "Halmos" for the 5-invariant CI. The Halmos README confirms it is EVM/Solidity-only.' },
      { label: 'Decision', text: 'Kani for Rust pure-function invariants; proptest for contract-level state behavior.' },
      { label: 'Alternatives', text: 'Certora (rejected: expensive, mainnet only). Manticore (rejected: Solidity bytecode focus). Coq/Lean proofs (rejected: too heavy for the team).' },
      { label: 'Consequences', text: 'Atrium publishes its Kani harnesses publicly. Honest signal: this was a lesson in not citing tools without verifying capability.' },
    ],
  },
  {
    id: '003',
    title: 'Arbitrum Sepolia primary, Robinhood Chain when the SDK ships',
    date: '2026-05-18',
    sections: [
      { label: 'Context', text: 'Earlier drafts claimed "dual-primary deployment from Day 1." A 2026-05-18 search confirmed no public Robinhood Chain SDK or contracts repo.' },
      { label: 'Decision', text: 'Arbitrum Sepolia is the actual primary. The RH-Chain adapter ships within 14 days after Robinhood publishes an SDK.' },
      { label: 'Alternatives', text: 'Wait for RH (rejected: cannot ship Year-1 on a chain with no SDK). Bet entirely on RH (rejected: same).' },
      { label: 'Consequences', text: 'The dual-primary claim is demoted to an honest conditional.' },
    ],
  },
  {
    id: '004',
    title: 'Hybrid Hyperliquid adapter (bridge + API + attestation), not contract-to-contract',
    date: '2026-05-18',
    sections: [
      { label: 'Context', text: 'HIP-3 perps run on the Hyperliquid L1 Rust binary, not as on-chain EVM contracts. The Hyperliquid contracts repo contains only Bridge2.sol.' },
      { label: 'Decision', text: 'Portico to Hyperliquid uses the bridge for collateral, an off-chain API for order placement, and an on-chain attestation of position state.' },
      { label: 'Alternatives', text: 'Skip Hyperliquid (rejected: it is the wedge, the biggest cross-margin demand source). Wait for an HL EVM (rejected: not on the roadmap).' },
      { label: 'Consequences', text: 'Adapter complexity is higher than pure contract-to-contract. An attest_off_chain_state(...) method was added to the IPorticoAdapter v1.0 interface for hybrid adapters.' },
    ],
  },
  {
    id: '005',
    title: 'Coffer single-vault per collateral type, not per position',
    date: '2026-05-12',
    sections: [
      { label: 'Context', text: 'Two patterns were possible: one Coffer vault for all collateral, or per-instrument/per-position vaults.' },
      { label: 'Decision', text: 'One Coffer vault per supported collateral type (USDC for v1; USDT and ETH later).' },
      { label: 'Alternatives', text: 'Per-position vaults (rejected: defeats the cross-margin purpose). A single multi-asset vault (rejected: the ERC-4626 spec is single-asset).' },
      { label: 'Consequences', text: 'Simpler accounting, standard ERC-4626 compatibility, cross-margin is natural.' },
    ],
  },
  {
    id: '006',
    title: 'Stylus contracts upgradeable via UUPS, not immutable',
    date: '2026-05-12',
    sections: [
      { label: 'Context', text: 'Testnet contracts need to evolve as we learn. Immutability is the mainnet promise.' },
      { label: 'Decision', text: 'UUPS upgradeable proxies for all core contracts in Year 1.' },
      { label: 'Alternatives', text: 'Immutable from day 1 (rejected: blocks iteration during the testnet phase).' },
      { label: 'Consequences', text: 'Upgrades are gated by the Praetor multisig + a 48h timelock. Documented as testnet-only; the mainnet flip is a per-contract decision.' },
    ],
  },
  {
    id: '007',
    title: 'Dual-oracle (Chainlink + Pyth) with median + tolerance, not primary + fallback',
    date: '2026-05-15',
    sections: [
      { label: 'Context', text: 'A single oracle is a single point of failure. Two oracles can disagree.' },
      { label: 'Decision', text: 'Both oracles are read on every recompute; the median is used within a 50bps tolerance, otherwise the system pauses.' },
      { label: 'Alternatives', text: 'Primary + fallback (rejected: implies a hierarchy). Median-of-three (rejected: cost; not enough Sepolia oracle options).' },
      { label: 'Consequences', text: 'Both oracles must be live for normal operation. Acceptable cost: oracle reads on Sepolia are cheap and the safety improvement is worth it.' },
    ],
  },
  {
    id: '008',
    title: 'Open-source IPorticoAdapter from Day 30, not closed source',
    date: '2026-05-15',
    sections: [
      { label: 'Context', text: 'Standard adoption requires open access; closed adapter standards die. Compare WalletConnect, ERC-20.' },
      { label: 'Decision', text: 'IPorticoAdapter v1.0 is MIT-licensed, published Day 30.' },
      { label: 'Alternatives', text: 'Keep it closed (rejected: kills the ecosystem moat). Open it later (rejected: no upside to delay).' },
      { label: 'Consequences', text: 'Anyone can build an adapter. Curator grants (5K ARB each) accelerate community adapter development.' },
    ],
  },
  {
    id: '009',
    title: 'System-wide Stylus snake_case to camelCase Solidity ABI convention',
    sections: [
      { label: 'Decision', text: 'Stylus emits methods as camelCase selectors. Every sol_interface! declaration that names a Stylus contract uses camelCase to match; Rust call-site method names stay snake_case via sol_interface!’s automatic name conversion.' },
      { label: 'Alternatives', text: 'A #[selector(name = "snake_case_name")] on each exporter, rejected because it requires per-method opt-in across ~40 methods and silently breaks if any method is missed.' },
    ],
  },
  {
    id: '010',
    title: 'Uniform pause(string) ABI accepting multisig OR timelock callers',
    sections: [
      { label: 'Decision', text: 'Every pausable Atrium contract exposes function pause(string reason) that accepts msg.sender in {praetor_multisig, praetor_timelock}. The multisig path is instant; the timelock path goes through PraetorTimelock.emergencyPause(target, reason) which forwards IPausable(target).pause(reason).' },
      { label: 'Reasoning', text: 'PraetorTimelock is the canonical pause helper; without the timelock as an accepted caller, the helper would forever revert. Resume is asymmetric, multisig-only with no timelock, because re-enabling money flow deserves the 3-of-5 governance check.' },
    ],
  },
  {
    id: '011',
    title: 'Codex x402 verification is on-chain authoritative',
    sections: [
      { label: 'Decision', text: 'The Coinbase facilitator is queried as a fast-path hint, but its valid:true response never bypasses local on-chain verification: a USDC Transfer log present in receipt.logs, log.address == CODEX_USDC_ADDRESS, topics[2] == payTo, data >= expectedMin, and at least 12 block confirmations. A UNIQUE constraint on payments.tx_hash prevents cross-isolate replay.' },
      { label: 'Trade-off', text: 'About 2 seconds of added latency per payment request for the RPC call, versus arbitrary trust in a third-party HTTP endpoint. Worth it for a payment surface.' },
    ],
  },
  {
    id: '012',
    title: 'Agent-template encoders mirror the on-chain Sigil decoder byte layout',
    sections: [
      { label: 'Decision', text: 'The agent template’s encode_intent_envelope and encode_action_envelope produce bytes that match the on-chain Sigil decode_intent and decode_action exactly. Three unit tests confirm minimum length, fixed action size, and oversize-venue rejection.' },
      { label: 'Consequences', text: 'Future drift on either side fails the agent-template unit tests rather than producing an envelope the decoder silently rejects.' },
    ],
  },
];

export function getAdr(id: string): Adr | undefined {
  return ADRS.find((a) => a.id === id);
}
