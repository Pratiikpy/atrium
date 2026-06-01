import { BigInt, Bytes, crypto, ByteArray, log } from '@graphprotocol/graph-ts';
import {
  Deposit,
  Withdraw,
  CircuitBreakerTripped,
  DepositsPaused,
  DepositsResumed,
  WithdrawalsPaused,
  WithdrawalsResumed,
  UsdcPausedDetected,
  HaircutApplied,
  AdapterCapHit,
} from '../generated/Coffer/Coffer';
import {
  CofferDeposit,
  CofferWithdraw,
  CircuitBreakerEvent,
  CofferUserBalance,
  CofferPauseState,
  AlertEvent,
  SubsystemDiagnosticEvent,
} from '../generated/schema';
import { incrementCounter } from './_shared/counter';

const COFFER_PAUSE_STATE_ID = '0';

function loadOrCreateCofferPauseState(): CofferPauseState {
  let state = CofferPauseState.load(COFFER_PAUSE_STATE_ID);
  if (state == null) {
    state = new CofferPauseState(COFFER_PAUSE_STATE_ID);
    state.isDepositsPaused = false;
    state.isWithdrawalsPaused = false;
  }
  return state;
}

function getOrCreateBalance(user: Bytes, blockNumber: BigInt): CofferUserBalance {
  const id = user.toHexString();
  let b = CofferUserBalance.load(id);
  if (!b) {
    b = new CofferUserBalance(id);
    b.user = user;
    b.balanceWei = BigInt.zero();
    b.netDepositedAssetsWei = BigInt.zero();
    // Per-user salt = keccak256(user), deterministic, private (off-chain caller must know the address)
    b.salt = Bytes.fromByteArray(crypto.keccak256(ByteArray.fromHexString(user.toHexString())));
    b.lastUpdatedBlock = blockNumber;
  }
  return b;
}

export function handleDeposit(event: Deposit): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new CofferDeposit(id);
  d.sender = event.params.sender;
  d.owner = event.params.owner;
  d.assets = event.params.assets;
  d.shares = event.params.shares;
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.save();

  const b = getOrCreateBalance(event.params.owner, event.block.number);
  b.balanceWei = b.balanceWei.plus(event.params.assets);
  b.netDepositedAssetsWei = b.balanceWei;
  b.lastUpdatedBlock = event.block.number;
  b.save();

  // Phase 4: Counter writes (SD-10)
  incrementCounter('totalDepositsCount', BigInt.fromI32(1), event.block.timestamp);
  incrementCounter('totalTvlWei', event.params.assets, event.block.timestamp);
}

export function handleWithdraw(event: Withdraw): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const w = new CofferWithdraw(id);
  w.sender = event.params.sender;
  w.receiver = event.params.receiver;
  w.owner = event.params.owner;
  w.assets = event.params.assets;
  w.shares = event.params.shares;
  w.blockNumber = event.block.number;
  w.timestamp = event.block.timestamp;
  w.save();

  const b = getOrCreateBalance(event.params.owner, event.block.number);
  const newBalance = b.balanceWei.minus(event.params.assets);
  if (newBalance.lt(BigInt.zero())) {
    // Phase 4 (SD-17): log warning on underflow, clamp to zero for display safety.
    log.warning('balance subtraction underflow user={} amount={}', [
      event.params.owner.toHexString(),
      event.params.assets.toString(),
    ]);
    b.balanceWei = BigInt.zero();
  } else {
    b.balanceWei = newBalance;
  }
  b.netDepositedAssetsWei = b.balanceWei;
  b.lastUpdatedBlock = event.block.number;
  b.save();

  // Phase 4: Counter writes (SD-10)
  incrementCounter('totalWithdrawalsCount', BigInt.fromI32(1), event.block.timestamp);
  // Subtract from TVL (incrementCounter clamps to zero internally)
  incrementCounter('totalTvlWei', BigInt.zero().minus(event.params.assets), event.block.timestamp);
}

export function handleCircuitBreaker(event: CircuitBreakerTripped): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const cb = new CircuitBreakerEvent(id);
  // Wave A.7: trigger is now bytes32 (keccak256 of a tag). Hex-encode for the
  // String schema field; consumers decode by matching against known digests.
  cb.trigger = event.params.trigger.toHexString();
  cb.measurement = event.params.measurement;
  cb.blockNumber = event.block.number;
  cb.timestamp = event.block.timestamp;
  cb.save();
}

// Audit K-4 fix: track Coffer split pause state.
export function handleDepositsPaused(event: DepositsPaused): void {
  const state = loadOrCreateCofferPauseState();
  state.isDepositsPaused = true;
  state.lastDepositReason = event.params.reason.toHexString();
  state.lastChangedAtBlock = event.block.number;
  state.save();
}

export function handleDepositsResumed(event: DepositsResumed): void {
  const state = loadOrCreateCofferPauseState();
  state.isDepositsPaused = false;
  state.lastChangedAtBlock = event.block.number;
  state.save();
}

export function handleWithdrawalsPaused(event: WithdrawalsPaused): void {
  const state = loadOrCreateCofferPauseState();
  state.isWithdrawalsPaused = true;
  state.lastWithdrawalReason = event.params.reason.toHexString();
  state.lastChangedAtBlock = event.block.number;
  state.save();
}

export function handleWithdrawalsResumed(event: WithdrawalsResumed): void {
  const state = loadOrCreateCofferPauseState();
  state.isWithdrawalsPaused = false;
  state.lastChangedAtBlock = event.block.number;
  state.save();
}

// Tier-1 ops alert. UsdcPausedDetected fires when the USDC contract itself
// is paused upstream (Circle has done this in production incidents).
// Coffer halts deposits + withdrawals automatically; the verify-app needs
// to surface why so users don't think Atrium is the cause.
export function handleUsdcPausedDetected(event: UsdcPausedDetected): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const a = new AlertEvent(id);
  a.kind = 'usdc_paused';
  a.contract = 'Coffer';
  a.txHash = event.transaction.hash;
  a.detail = 'Upstream USDC contract paused by Circle';
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.save();
}

// Tier-2 defensive observability. Per-call collateral haircut accounting:
// `sum(amountWei) over window` is the adapter-fee accumulation surface.
export function handleHaircutApplied(event: HaircutApplied): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'haircut_applied';
  d.contract = 'Coffer';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.user = event.params.user;
  d.amountWei = event.params.haircut_amount_wei;
  d.toleranceBps = event.params.haircut_bps;
  d.save();
}

// Tier-2 defensive observability. Pre-malicious-adapter signal: an adapter
// tried to pull more than its per-block cap. Vigil/ops dashboard surfaces.
export function handleAdapterCapHit(event: AdapterCapHit): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const d = new SubsystemDiagnosticEvent(id);
  d.kind = 'adapter_cap_hit';
  d.contract = 'Coffer';
  d.blockNumber = event.block.number;
  d.timestamp = event.block.timestamp;
  d.adapter = event.params.adapter;
  d.amountWei = event.params.attempted_wei;
  d.capWei = event.params.cap_wei;
  d.save();
}
