#!/usr/bin/env node
// @ts-check
/**
 * Event-indexing coverage gate.
 *
 * Walks every Solidity + Stylus contract under contracts/ and extracts the
 * `event Foo(arg1, arg2)` declarations. Then walks subgraph/subgraph.yaml,
 * extracting the `eventHandlers[].event` strings. Reports any contract event
 * that has no corresponding subgraph handler.
 *
 * This catches the class of bugs found in 2026-05 audits: AtriumRouter
 * (Fire 74) and Curator (Fire 75) both shipped events that lived 8+ fires
 * on-chain without ever being indexed, silently breaking the verify-app
 * dashboards that depend on Scribe. The fix went into iteration 9 of the
 * /loop session; this gate prevents the recurrence.
 *
 * Exit codes:
 *   0  every contract event has a subgraph handler, or it's on the
 *      INDEXING_IGNORE allow-list.
 *   1  unindexed events detected; CI should fail the build.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

// Events deliberately NOT indexed. Each entry: "ContractName.EventName" or
// "*.EventName" wildcard, mapped to a one-line reason so future maintainers
// can audit the choice.
const INDEXING_IGNORE = new Map([
  ['Aqueduct.LinkUsage30dUpdated', 'rolling-window internal accumulator; canonical state via CrossChainCredit'],
  // Per-adapter position events are duplicated by Plinth.PositionOpened
  // (which carries venue_id discriminator) and AtriumRouter.PositionOpenedViaRouter.
  ['*.PositionOpened', 'Plinth + AtriumRouter capture the canonical record; per-adapter duplicates'],
  ['*.PositionClosed', 'Plinth + AtriumRouter capture the canonical record'],
  ['*.PositionModified', 'modify_position is v2; v1 reverts'],
  ['*.VenueHealthChanged', 'view-only; /v1/venues/health reads live state directly'],
  ['*.AttestationAccepted', 'per-adapter; Sigil-side validation events are canonical'],
  ['*.AuthorizedCallerUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['*.InstrumentAdded', 'Praetor timelock action; captured via PraetorTimelock.Executed'],
  // Stoa is pure-math; no state events to index.
  // ['StoaBlackScholes.StoaPhase2NotLive', '...'], removed iter 52 alongside
  // the dead event declaration in Stoa. No event to ignore anymore.
  // Aqueduct destination/claimback chain events live on the OTHER chain. Indexing
  // them would require a separate subgraph deployment; source-chain Aqueduct
  // already captures the lifecycle end-to-end via CrossChainCredit*.
  ['AqueductReceiver.CrossChainCreditReceived', 'destination-chain event; needs separate subgraph'],
  ['AqueductReceiver.SourceAqueductSet', 'destination-chain admin event'],
  ['AqueductReceiver.SourceClaimbackRegistrySet', 'destination-chain admin event'],
  ['AqueductReceiver.DeliveryAckQueued', 'destination-chain operational event'],
  ['AqueductClaimback.DeliveryAckReceived', 'destination-chain handshake; source-side has CrossChainCreditClaimedBack'],
  // Admin/setup events: Praetor multisig is the canonical actor, and
  // PraetorTimelock.Executed already captures every multisig action with the
  // calldata. These per-contract admin events are redundant.
  ['*.RiskParamsUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['*.ValidatorSetUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['*.DestinationUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['*.PraetorUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['Aqueduct.AqueductOnDestSet', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['Aqueduct.ClaimbackRegistryUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['Aqueduct.LinkDeposited', 'operational top-up; LINK balance polled directly from ERC-20'],
  ['Edict.SumsubVerifierUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  ['LanternAttestor.SigningKeyRotated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  // Faucet onboarding events: per-claim flow does not need a subgraph entity
  // (the /api/faucet/status route reads claim state from on-chain via viem),
  // and the Stocked event is a Praetor manual top-up that PraetorTimelock
  // does not currently route through.
  ['Faucet.Claimed', 'per-user claim history not surfaced in subgraph; on-chain lastClaim[user] is canonical'],
  ['Faucet.Stocked', 'manual top-up from Praetor; balance polled directly from USDC.balanceOf'],
  // Stylus pause/resume admin events added in the 2026-05-24 audit C-5 fix.
  // PraetorTimelock.Executed already captures the calldata for resume calls
  // (timelock-only). Direct multisig pause is the only non-timelock path;
  // the UI surfaces it via /api/deployments/status reading is_paused live.
  ['Sigil.SigilPausedEvent', 'admin pause hook; live is_paused state read directly via viem in deployments/status'],
  ['Sigil.SigilResumedEvent', 'timelock-only; captured via PraetorTimelock.Executed'],
  ['Vigil.VigilPausedEvent', 'admin pause hook; live is_paused state read directly via viem in deployments/status'],
  ['Vigil.VigilResumedEvent', 'timelock-only; captured via PraetorTimelock.Executed'],
  ['AtriumRouter.RouterPaused', 'admin pause hook; live is_paused state read directly via viem in deployments/status'],
  ['AtriumRouter.RouterResumed', 'timelock-only; captured via PraetorTimelock.Executed'],
  ['AtriumRouter.HedgedPairOpened', 'compound router action; canonical legs captured by PositionOpenedViaRouter/Plinth'],
  ['Coffer.CollateralReturned', 'withdraw/redeem fulfillment; canonical user flow captured by Withdraw'],
  ['Vigil.KeeperUnstaked', 'keeper self-service stake accounting; live stake read directly from Vigil.jobs/keepers when surfaced'],
  ['Vigil.RewardsClaimed', 'keeper reward withdrawal; accrued rewards already captured via KeeperRewarded'],
  ['Vigil.KeeperMinStakeUpdated', 'Praetor multisig action; captured via PraetorTimelock.Executed'],
  // Testnet-only mocks are deployed to make unsupported upstream protocols usable
  // on Arbitrum Sepolia. Scribe indexes Atrium protocol events, not mock ERC-20
  // or mock venue internals.
  ['MockAavePool.Supply', 'testnet mock venue internals; Atrium flow captured via router/coffer/plinth events'],
  ['MockAavePool.Withdraw', 'testnet mock venue internals; Atrium flow captured via router/coffer/plinth events'],
  ['MockChainlinkUsdFeed.AnswerUpdated', 'testnet mock oracle internals; live price state read directly when needed'],
  ['MockUSDC.Transfer', 'testnet mock ERC-20 internals; Coffer/Router events are canonical for product flows'],
  ['MockUSDC.Approval', 'testnet mock ERC-20 internals; allowance is wallet/ERC-20 state, not a Scribe product event'],
]);

const EVENT_RE = /^\s*event\s+([A-Z]\w*)\s*\(/gm;
const HANDLER_RE = /-\s*event:\s*([A-Z]\w*)\s*\(/g;

async function* walk(dir, exts) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'foundry-out' || entry.name === 'target' || entry.name === '.forge-cache') continue;
      yield* walk(p, exts);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      yield p;
    }
  }
}

function toPascal(slug) {
  return slug.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

async function collectEvents() {
  const out = [];
  for await (const file of walk(path.join(REPO_ROOT, 'contracts'), ['.sol', '.rs'])) {
    const text = await readFile(file, 'utf8');
    // Stylus contracts live at `contracts/<slug>/src/lib.rs` per convention;
    // use the contract-dir slug as the canonical name.
    const isStylusLib = file.endsWith(`${path.sep}lib.rs`);
    const contractName = isStylusLib
      ? toPascal(path.basename(path.dirname(path.dirname(file))))
      : path.basename(file, path.extname(file));
    for (const match of text.matchAll(EVENT_RE)) {
      out.push({ contractName, eventName: match[1], file: path.relative(REPO_ROOT, file) });
    }
  }
  return out;
}

/**
 * Parse subgraph.yaml into per-data-source handler sets.
 *
 * Pre-fix the gate matched event names globally, if PraetorTimelock emits
 * EmergencyPaused but only Aqueduct's handler is registered, the gate would
 * falsely report it as covered because the name 'EmergencyPaused' appears
 * somewhere in subgraph.yaml. Same-name-different-contract collisions are
 * common in this codebase (Resumed, EmergencyPaused, pauseEvents).
 *
 * Returns: Map<DataSourceName, Set<EventName>>.
 */
async function collectHandlersPerSource() {
  const yaml = await readFile(path.join(REPO_ROOT, 'subgraph', 'subgraph.yaml'), 'utf8');
  const perSource = new Map();
  const lines = yaml.split(/\r?\n/);
  let currentSource = null;
  for (const line of lines) {
    // A new data source starts at "  - kind: ethereum" (2-space indent).
    // The following "    name: X" line gives the source name. Reset state.
    const nameMatch = line.match(/^\s{4}name:\s*(\w+)\s*$/);
    if (nameMatch) {
      currentSource = nameMatch[1];
      if (!perSource.has(currentSource)) perSource.set(currentSource, new Set());
      continue;
    }
    const handlerMatch = line.match(/^\s+-\s+event:\s+([A-Z]\w*)\s*\(/);
    if (handlerMatch && currentSource != null) {
      perSource.get(currentSource).add(handlerMatch[1]);
    }
  }
  return perSource;
}

/**
 * Resolve which subgraph data source corresponds to a given contract name.
 *
 * For most contracts the data-source name matches the contract name
 * (Plinth, Coffer, Aqueduct, etc.). A few have aliases, capture those
 * explicitly so the gate matches correctly. When a contract has NO data
 * source, treat its events as un-handled (the contract is invisible to
 * the indexer).
 */
const CONTRACT_TO_SOURCE = {
  // Stylus contracts use their dir slug PascalCased; explicit map keeps the
  // resolution loud rather than relying on convention.
  Plinth: 'Plinth',
  Coffer: 'Coffer',
  Vigil: 'Vigil',
  Sigil: 'Sigil',
  StoaBlackScholes: null, // pure math, no events to index
  // Solidity contracts.
  Aqueduct: 'Aqueduct',
  AqueductReceiver: null, // destination-chain; separate subgraph
  AqueductClaimback: null, // destination-chain
  Edict: 'Edict',
  PorticoRegistry: 'PorticoRegistry',
  PraetorTimelock: 'PraetorTimelock',
  PosternKillSwitch: 'PosternKillSwitch',
  PosternKeyRegistry: 'PosternKeyRegistry',
  ResearchAttestation: 'ResearchAttestation',
  LanternAttestor: 'LanternAttestor',
  AtriumRouter: 'AtriumRouter',
  Rostrum: 'Rostrum',
  Curator: 'Curator',
};

function lookupSource(contractName) {
  // Adapters and other non-mapped contracts default to null, their events
  // aren't separately indexed (they ride on Plinth/Router/Coffer events).
  if (Object.prototype.hasOwnProperty.call(CONTRACT_TO_SOURCE, contractName)) {
    return CONTRACT_TO_SOURCE[contractName];
  }
  return null;
}

function isIgnored(contractName, eventName) {
  if (INDEXING_IGNORE.has(`${contractName}.${eventName}`)) return true;
  if (INDEXING_IGNORE.has(`*.${eventName}`)) return true;
  return false;
}

async function main() {
  const events = await collectEvents();
  const perSource = await collectHandlersPerSource();
  const unindexed = [];
  const indexed = [];
  const ignored = [];
  for (const e of events) {
    // 1. Resolve which data source this contract's events would land in.
    const sourceName = lookupSource(e.contractName);
    const sourceHandlers = sourceName != null ? perSource.get(sourceName) : null;
    // 2. Per-source coverage: the event must be in THIS contract's handler
    //    set, not just somewhere in subgraph.yaml.
    if (sourceHandlers != null && sourceHandlers.has(e.eventName)) {
      indexed.push(e);
    } else if (isIgnored(e.contractName, e.eventName)) {
      ignored.push(e);
    } else {
      unindexed.push(e);
    }
  }
  console.log('event-indexing audit:');
  console.log(`  indexed:   ${indexed.length}`);
  console.log(`  ignored:   ${ignored.length} (per INDEXING_IGNORE allow-list)`);
  console.log(`  UNINDEXED: ${unindexed.length}`);
  if (unindexed.length > 0) {
    console.log('\nunindexed events  add a handler in subgraph.yaml, or add to INDEXING_IGNORE with a reason:');
    for (const e of unindexed) {
      console.log(`  ${e.contractName}.${e.eventName}  (${e.file})`);
    }
    process.exit(1);
  }
  console.log('\nall events accounted for.');
}

// Iter 79: export helpers for unit testing (`scripts/check-event-indexing.test.mjs`).
export { toPascal, lookupSource, isIgnored, CONTRACT_TO_SOURCE, INDEXING_IGNORE };

// Only invoke main() when run as a CLI, not when imported as a module for
// unit tests. The url-comparison handles both POSIX and Windows entry paths.
import { fileURLToPath } from 'node:url';
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
               import.meta.url === fileURLToPath(import.meta.url) ||
               process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main().catch((err) => {
    console.error('check-event-indexing failed:', err);
    process.exit(2);
  });
}
