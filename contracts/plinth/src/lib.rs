// Plinth, Atrium SPAN-style portfolio margin engine
//
// Stylus (Rust) contract that computes required margin across a user's positions
// using a SPAN-style scenario matrix. Compute-heavy work targeted at 10-100x
// cheaper gas than a Solidity equivalent (per Arbitrum's published Stylus
// benchmarks at resources/arbitrum-docs/docs/stylus/concepts/gas-metering.mdx).
//
// Architecture notes:
// - Storage uses ERC-7201 namespaced slots for safe UUPS upgrades
// - All host calls go through self.vm() per stylus-sdk-rs 0.6+ API
// - Dual oracle (Chainlink + Pyth) median with 50bps tolerance + 60s freshness
// - Vigil is called explicitly when an account becomes under-collateralized
// - margin_version nonce closes the race between update_margin and liquidation

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
// Switch to no_std for on-chain wasm builds only. The export-abi feature
// (used by `cargo stylus`) needs std for the generated abi printers.
#![cfg_attr(not(any(feature = "export-abi", test)), no_std)]

extern crate alloc;

use alloc::{vec, vec::Vec};
use alloy_primitives::{Address, B256, FixedBytes, I256, Uint, U256};
use alloy_sol_types::sol;
use stylus_sdk::{
    abi::Bytes,
    prelude::*,
};

// --- Module: pure math (Kani-verifiable, no storage) ---
// math.rs gated to test/export-abi builds only, its functions either inlined
// at call sites or moved to plinth-math/plinth-oracle for the on-chain build.
// `test-host` exposes it to the external proptest integration test crate
// (tests/proptest_invariants.rs), which runs as a separate compilation unit
// where the implicit `test` cfg on this lib is NOT set.
#[cfg(any(test, feature = "export-abi", feature = "test-host"))]
pub mod math;
// span::required_margin moved to the standalone PlinthMath contract
// (contracts/plinth-math) to keep Plinth under EIP-170's 24 KB cap.
// span.rs stays in the tree as the off-chain reference implementation
// for tests and Kani proofs, gated to non-wasm builds.
#[cfg(any(test, feature = "export-abi", feature = "test-host"))]
pub mod span;

#[cfg(test)]
mod tests;

/// Audit fix (#63): floor-divide signed realized PnL toward negative infinity.
/// Plain Rust integer division truncates toward zero, which rounds a losing
/// position's booked loss toward zero (favouring the trader against the vault).
/// The margin path (plinth-math::position_pnl_under_price) already floor-divides;
/// the realization path (close_position / reduce_position) must match. Mirrors
/// plinth-math::signed_floor_div, inlined here because math.rs is gated out of
/// the on-chain build. floor_div(-7, 2) = -4, not -3.
fn floor_div_i256(numerator: I256, denominator: I256) -> I256 {
    if denominator.is_zero() {
        return I256::ZERO;
    }
    let q = numerator / denominator;
    let r = numerator % denominator;
    if !r.is_zero() && (numerator ^ denominator).is_negative() {
        q - I256::try_from(1i64).unwrap_or(I256::ZERO)
    } else {
        q
    }
}

// =============================================================================
// Events (Solidity-compatible)
// =============================================================================
sol! {
    event MarginUpdated(
        address indexed user,
        uint256 collateral_value_wei,
        uint256 required_margin_wei,
        uint256 margin_version,
        uint64 block_number
    );

    event PositionOpened(
        uint256 indexed position_id,
        address indexed owner,
        uint8 venue_id,
        bytes32 instrument_id,
        int256 notional_signed,
        uint256 entry_price_q64,
        bytes32 intent_hash
    );

    event PositionClosed(
        uint256 indexed position_id,
        int256 realized_pnl_signed
    );

    // `reason` was `string`; bytes32 cuts ~400 bytes of no_std alloc/format.
    event AccountPaused(address indexed user, bytes32 reason);
    event AccountResumed(address indexed user);
    event PlinthPaused(bytes32 reason, uint64 block_number);
    event PlinthResumed(uint64 block_number);
    event OracleDisagreement(uint256 chainlink_price, uint256 pyth_price, uint16 tolerance_bps);
    // Audit AAA-1 fix: surface a failed Vigil.queue_liquidation call so
    // off-chain monitors can re-queue. Previously the call was silently
    // discarded with `let _ =`; the account paused but the liquidation job
    // never queued, leaving the user in a zombie frozen state forever.
    event VigilQueueFailed(address indexed user, uint256 margin_version);
}

// =============================================================================
// Errors
// =============================================================================
// Size-optimization (Wave A): collapsed 15 typed errors into a single
// `PlinthErr(uint16 code)` to fit the 24 KB EIP-170 cap. Saves ~5 KB
// compressed wasm by reusing one Sol selector/encoder across all revert
// sites. External decoders map codes back to messages, see ERROR_CODES
// const below. Restore typed errors when we move to a wasm-aware deployer
// in Year-2.
sol! {
    error PlinthErr(uint16 code);
}

// Error codes, keep in sync with off-chain decoder.
pub const ERR_ACCOUNT_PAUSED: u16 = 1;
pub const ERR_GLOBALLY_PAUSED: u16 = 2;
pub const ERR_ORACLE_STALE: u16 = 3;
pub const ERR_ORACLE_DISAGREEMENT: u16 = 4;
pub const ERR_TOO_MANY_POSITIONS: u16 = 5;
pub const ERR_INVALID_ACTION_SIGIL: u16 = 6;
pub const ERR_UNAUTHORIZED: u16 = 7;
pub const ERR_REENTRANT: u16 = 8;
pub const ERR_UNKNOWN_VENUE: u16 = 9;
pub const ERR_INVALID_NOTIONAL: u16 = 10;
pub const ERR_ORACLE_DECIMALS_UNREADABLE: u16 = 11;
pub const ERR_ORACLE_NEGATIVE_PRICE: u16 = 12;
pub const ERR_COFFER_UNREACHABLE: u16 = 13;
pub const ERR_CORRELATION_CLASS_OOR: u16 = 14;
pub const ERR_PYTH_NEGATIVE_PRICE: u16 = 15;
/// Phase theta.1 fix (2026-05-25): pre-fix the required-margin call to the
/// PlinthMath helper used `.unwrap_or(U256::ZERO)`, silently treating a
/// reverting math contract as "no margin required". Under-collateralised
/// accounts then looked healthy and the next update_margin tick would not
/// auto-pause them, opening a Vigil-bypass path. New behavior: surface the
/// failure as a distinct error code so the calling tx reverts loud.
pub const ERR_MATH_UNREACHABLE: u16 = 16;

/// Phase 2a: distinguishes open-time margin check (applies 1.5× multiplier)
/// from maintenance-path margin check (no multiplier). The initial margin
/// multiplier ensures new positions have a safety buffer above maintenance.
#[derive(Clone, Copy, PartialEq, Eq)]
enum MarginCheckKind {
    Open,
    Maintenance,
}

/// Phase 2a: initial margin multiplier applied at open time only.
/// 1.5× = 15000 / 10000. Ensures new positions start with 50% buffer above
/// maintenance margin, giving time for orderly liquidation if price moves.
const INITIAL_MARGIN_MULTIPLIER_BPS: u64 = 15_000;

#[derive(SolidityError)]
pub enum PlinthError {
    Err(PlinthErr),
}

impl PlinthError {
    #[inline]
    fn code(c: u16) -> Self { Self::Err(PlinthErr { code: c }) }
}

// =============================================================================
// External interfaces
// =============================================================================
sol_interface! {
    interface IVigil {
        function queueLiquidation(address user, uint256 margin_version) external;
    }
    interface ICoffer {
        function balanceOf(address user) external view returns (uint256);
        function convertToAssets(uint256 shares) external view returns (uint256);
        function totalAssets() external view returns (uint256);
    }
    interface IPorticoRegistry {
        function isRegisteredAdapter(address adapter) external view returns (bool);
        function getAdapter(uint8 venue_id) external view returns (address);
    }
    // Oracle reading moved to PlinthOracle (contracts/plinth-oracle) for
    // EIP-170 size reasons. See Phase A.7 in LAUNCH_READY.md.
    interface IPlinthOracle {
        function safePrice(
            address pyth_oracle,
            address chainlink_feed,
            bytes32 pyth_feed_id,
            uint64 freshness_seconds,
            uint16 tolerance_bps
        ) external view returns (uint256);
    }
    interface ISigil {
        // Audit G-3 fix: was `view`; now mutating because validate_action
        // persists rate-limit and credit-line counters after recovery.
        function validateAction(bytes calldata intent_bytes, bytes calldata action_bytes)
            external returns (bool valid);
        // Phase 2a: Plinth calls this on close_position to decrement the
        // agent's running open-notional counter. Lands in Sigil same phase.
        function recordClose(address agent, uint256 amount) external;
    }
    // Separated SPAN math, see contracts/plinth-math. Plinth calls this
    // every time it recomputes a user's required margin.
    interface IPlinthMath {
        function requiredMargin(
            int256[] memory notionals,
            uint256[] memory entry_prices_q64,
            uint256[] memory current_prices_q64,
            uint16[] memory haircuts_bps,
            uint16[] memory correlation_classes,
            uint16 min_initial_margin_bps,
            uint16 maint_margin_buffer_bps
        ) external view returns (uint256);
    }
}

// =============================================================================
// Storage
// =============================================================================
sol_storage! {
    #[entrypoint]
    pub struct Plinth {
        // === Accounts and positions ===
        mapping(address => MarginAccount) accounts;
        mapping(uint256 => Position) positions;
        mapping(address => uint256[]) user_position_ids;
        uint256 next_position_id;

        // === External wiring ===
        address coffer_address;
        address vigil_address;
        address sigil_address;
        address portico_registry_address;
        address chainlink_oracle;
        address pyth_oracle;
        address praetor_multisig;
        address praetor_timelock;  // F-32 fix: 48h-gated parameter changes
        address authorized_router;  // FIRE-OWN fix: the trusted AtriumRouter that may open_position_for(owner) on a user's behalf
        address plinth_math_address;    // A.7 fix: split SPAN compute
        address plinth_oracle_address;  // A.7 fix: split oracle reading

        // === Reentrancy guard ===
        bool is_updating;

        // === Global pause ===
        bool is_global_paused;

        // === Parameters ===
        PlinthParams params;

        // === Instrument config: venue_id+instrument_id -> RiskConfig ===
        mapping(bytes32 => InstrumentRisk) instrument_risk;
    }

    pub struct MarginAccount {
        uint256 collateral_value_wei;
        uint256 required_margin_wei;
        uint64 last_update_block;
        uint64 last_oracle_publish_time;
        uint256 margin_version;
        bool is_paused;
        uint16 risk_tier;
    }

    pub struct Position {
        address owner;
        address agent;  // Phase 2a: track which agent opened this position (Address::ZERO if user-direct)
        uint8 venue_id;
        bytes32 instrument_id;
        int256 notional_signed;
        uint256 entry_price_q64;
        uint64 opened_at_block;
        uint16 haircut_bps;
        uint16 correlation_class;
    }

    pub struct PlinthParams {
        uint16 max_positions_per_user;
        uint16 max_correlation_classes;
        uint16 oracle_tolerance_bps;
        uint32 oracle_freshness_seconds;
        uint16 partial_liquidation_max_bps;
        uint16 min_initial_margin_bps;
        uint16 maint_margin_buffer_bps;
        bytes32 pyth_feed_id_default;
    }

    pub struct InstrumentRisk {
        uint16 haircut_bps;
        uint16 correlation_class;
        bytes32 pyth_feed_id;
        address chainlink_feed;
        bool is_active;
    }
}

// =============================================================================
// Public ABI
// =============================================================================
#[public]
impl Plinth {
    /// One-time initializer. Bound to the deployer via msg_sender at
    /// construction time; subsequent callers cannot front-run.
    /// Audit A-4 fix: initialize race closed.
    /// Audit F-32 fix: `praetor_timelock` stored alongside the multisig; all
    /// subsequent admin checks compare against the timelock, not the
    /// multisig directly.
    /// Stylus constructor, invoked exactly once at deploy time by the
    /// Stylus deployer factory. We use tx_origin() not msg_sender() to
    /// identify the deployer because the factory itself is the immediate
    /// caller.
    #[constructor]
    pub fn constructor(
        &mut self,
        coffer: Address,
        vigil: Address,
        sigil: Address,
        portico_registry: Address,
        chainlink: Address,
        pyth: Address,
        praetor: Address,
        praetor_timelock: Address,
        plinth_math: Address,
        plinth_oracle: Address,
    ) {
        // Refuse zero-address admin args. Without this guard a deployer typo
        // could brick all timelock-gated parameter changes (audit F-G).
        // We can't return an error from a constructor, assert instead.
        assert!(!praetor.is_zero(), "praetor zero");
        assert!(!praetor_timelock.is_zero(), "timelock zero");
        assert!(!plinth_math.is_zero(), "math zero");
        assert!(!plinth_oracle.is_zero(), "oracle zero");
        self.coffer_address.set(coffer);
        self.vigil_address.set(vigil);
        self.sigil_address.set(sigil);
        self.praetor_timelock.set(praetor_timelock);
        self.portico_registry_address.set(portico_registry);
        self.chainlink_oracle.set(chainlink);
        self.pyth_oracle.set(pyth);
        self.praetor_multisig.set(praetor);
        self.plinth_math_address.set(plinth_math);
        self.plinth_oracle_address.set(plinth_oracle);

        // Default parameters per TDD §7.1
        self.params.max_positions_per_user.set(Uint::<16, 1>::from(100u16));
        self.params.max_correlation_classes.set(Uint::<16, 1>::from(16u16));
        self.params.oracle_tolerance_bps.set(Uint::<16, 1>::from(50u16));
        self.params.oracle_freshness_seconds.set(Uint::<32, 1>::from(60u32));
        self.params.partial_liquidation_max_bps.set(Uint::<16, 1>::from(1_000u16));
        self.params.min_initial_margin_bps.set(Uint::<16, 1>::from(500u16));
        self.params.maint_margin_buffer_bps.set(Uint::<16, 1>::from(200u16));
    }

    /// Open a new position. Called by the venue adapter on behalf of user or agent.
    /// If `action_sigil` is empty, msg_sender must own the account.
    /// If non-empty, Sigil validates the mandate.
    pub fn open_position(
        &mut self,
        venue_id: u8,
        instrument_id: FixedBytes<32>,
        notional_signed: I256,
        action_sigil: Bytes,
        intent_sigil: Bytes,
    ) -> Result<U256, PlinthError> {
        self.assert_not_globally_paused()?;

        // Audit H-H1 fix: arm the reentrancy guard at function entry, not
        // just inside update_margin. Sigil.validateAction is now mutating
        // (G-3) and any future Sigil upgrade could legitimately call back
        // into Plinth before update_margin runs. Without this guard a
        // re-entered open_position would double-spend the intent's
        // credit-line before validateAction's counters persist.
        if self.is_updating.get() {
            return Err(PlinthError::code(ERR_REENTRANT));
        }
        self.is_updating.set(true);

        let result = self.open_position_inner(
            venue_id,
            instrument_id,
            notional_signed,
            action_sigil,
            intent_sigil,
            Address::ZERO,
        );

        self.is_updating.set(false);
        result
    }

    /// Router-only: open a position on behalf of `owner`. The trusted
    /// AtriumRouter (set via set_authorized_router) calls Plinth on the user's
    /// behalf, so resolve_owner-from-caller would file the position under the
    /// Router (FIRE-OWN bug: router goes underwater + the user can't close).
    /// This entry lets the Router name the real owner. Mirrors open_position's
    /// reentrancy guard exactly.
    pub fn open_position_for(
        &mut self,
        owner: Address,
        venue_id: u8,
        instrument_id: FixedBytes<32>,
        notional_signed: I256,
        action_sigil: Bytes,
        intent_sigil: Bytes,
    ) -> Result<U256, PlinthError> {
        self.assert_not_globally_paused()?;
        let caller = self.vm().msg_sender();
        let router = self.authorized_router.get();
        // Only the trusted Router may name an arbitrary owner. Closed until a
        // router is set (zero address never equals a real caller).
        if router.is_zero() || caller != router || owner.is_zero() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        if self.is_updating.get() {
            return Err(PlinthError::code(ERR_REENTRANT));
        }
        self.is_updating.set(true);
        let result = self.open_position_inner(
            venue_id,
            instrument_id,
            notional_signed,
            action_sigil,
            intent_sigil,
            owner,
        );
        self.is_updating.set(false);
        result
    }

    /// Timelock-only: set the authorized AtriumRouter permitted to call
    /// open_position_for on a user's behalf. Mirrors set_instrument_risk's gate.
    pub fn set_authorized_router(&mut self, router: Address) -> Result<(), PlinthError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        self.authorized_router.set(router);
        Ok(())
    }

    fn open_position_inner(
        &mut self,
        venue_id: u8,
        instrument_id: FixedBytes<32>,
        notional_signed: I256,
        action_sigil: Bytes,
        intent_sigil: Bytes,
        explicit_owner: Address,
    ) -> Result<U256, PlinthError> {
        let caller = self.vm().msg_sender();
        // FIRE-OWN fix: when the trusted Router opens on a user's behalf it
        // passes the REAL owner (non-zero) and empty sigils, so use that owner
        // directly on the owner-direct path. ANY non-empty sigil still goes
        // through resolve_owner so agent-mandate signatures + caps stay
        // enforced. The direct (non-Router) path passes Address::ZERO and is
        // unchanged (Option<Address> isn't a Stylus ABI type, so a zero
        // sentinel is used instead).
        let owner = if !explicit_owner.is_zero()
            && action_sigil.is_empty()
            && intent_sigil.is_empty()
        {
            explicit_owner
        } else {
            self.resolve_owner(caller, &action_sigil, &intent_sigil)?
        };
        self.assert_account_not_paused(owner)?;

        // Audit blocker fix (contracts-rust #2): bind the calldata args to the
        // SIGNED ActionSigil. resolve_owner only verifies the signature + caps
        // via Sigil; it never returns or checks the action's venue/instrument/
        // notional against Plinth's plain calldata args. Without this, an agent
        // could sign a valid ActionSigil for (venue X, instrument Y, $100) -
        // passing every Sigil cap check - then call open_position with ANY
        // venue/instrument/notional it wants, defeating the per-action notional
        // cap and the venue/instrument allowlist entirely. We decode the action
        // body (same fixed layout as sigil::eip712::decode_action: venue_id @
        // byte 63, instrument_id @ 64..96, notional_signed I256-BE @ 96..128)
        // and require the calldata to match exactly. Enforced only on the agent
        // path (non-empty action_sigil); an owner-direct open signs the tx itself.
        if !action_sigil.is_empty() {
            if action_sigil.len() < 128 {
                return Err(PlinthError::code(ERR_INVALID_ACTION_SIGIL));
            }
            let action_venue = action_sigil[63];
            let action_instrument = FixedBytes::<32>::from_slice(&action_sigil[64..96]);
            let mut nbytes = [0u8; 32];
            nbytes.copy_from_slice(&action_sigil[96..128]);
            let action_notional = I256::from_be_bytes::<32>(nbytes);
            if action_venue != venue_id
                || action_instrument != instrument_id
                || action_notional != notional_signed
            {
                return Err(PlinthError::code(ERR_INVALID_ACTION_SIGIL));
            }
        }

        // Phase 2a: resolve agent address from intent envelope.
        // If action_sigil is non-empty, the agent is the second address in the
        // intent envelope (bytes 32..64, left-padded). If empty, no agent.
        let agent: Address = if !intent_sigil.is_empty() && intent_sigil.len() >= 64 {
            let mut addr_bytes = [0u8; 20];
            addr_bytes.copy_from_slice(&intent_sigil[44..64]);
            Address::from(addr_bytes)
        } else {
            Address::ZERO
        };

        // Validate instrument is active + has risk config
        let key = instrument_key(venue_id, instrument_id);
        let risk = self.instrument_risk.getter(key);
        if !risk.is_active.get() {
            return Err(PlinthError::code(ERR_UNKNOWN_VENUE));
        }
        if notional_signed.is_zero() {
            return Err(PlinthError::code(ERR_INVALID_NOTIONAL));
        }

        // Position count cap
        let user_positions = self.user_position_ids.getter(owner);
        let count = user_positions.len();
        let max_positions: u16 = self.params.max_positions_per_user.get().to::<u16>();
        if count >= max_positions as usize {
            return Err(PlinthError::code(ERR_TOO_MANY_POSITIONS));
        }

        // Allocate position id
        let position_id = self.next_position_id.get() + U256::from(1);
        self.next_position_id.set(position_id);

        // Read entry price (median check inside)
        let price = self.get_safe_price(venue_id, instrument_id)?;

        // Hoist VM reads before the storage `.setter()` mutable borrow, so we
        // don't try to take `&self` (via vm()) while `&mut self` is still
        // outstanding via the `pos` setter. Same pattern as Coffer adapter_pull.
        let opened_at_block = self.vm().block_number();
        let haircut_bps = risk.haircut_bps.get().to::<u16>();
        let correlation_class = risk.correlation_class.get().to::<u16>();

        // Persist position
        let mut pos = self.positions.setter(position_id);
        pos.owner.set(owner);
        pos.agent.set(agent); // Phase 2a: store agent
        pos.venue_id.set(Uint::<8, 1>::from(venue_id));
        pos.instrument_id.set(instrument_id);
        pos.notional_signed.set(notional_signed);
        pos.entry_price_q64.set(price);
        pos.opened_at_block.set(Uint::<64, 1>::from(opened_at_block));
        pos.haircut_bps.set(Uint::<16, 1>::from(haircut_bps));
        pos.correlation_class.set(Uint::<16, 1>::from(correlation_class));

        // Track in user list
        let mut user_list = self.user_position_ids.setter(owner);
        user_list.push(position_id);

        // Phase 2a: compute intent_hash for Agent.totalPnlSigned join
        let intent_hash: B256 = if !intent_sigil.is_empty() {
            B256::from(alloy_primitives::keccak256(&intent_sigil))
        } else {
            B256::ZERO
        };

        self.vm().log(PositionOpened {
            position_id,
            owner,
            venue_id,
            instrument_id,
            notional_signed,
            entry_price_q64: price,
            intent_hash,
        });

        // Recompute margin atomically (also triggers Vigil if under-collateralized).
        // Phase 2a: pass MarginCheckKind::Open to apply 1.5× initial margin multiplier.
        self.do_update_margin_with_kind(owner, MarginCheckKind::Open)?;

        Ok(position_id)
    }

    /// Close a position. Pure user action (or Vigil during liquidation).
    pub fn close_position(&mut self, position_id: U256) -> Result<I256, PlinthError> {
        self.assert_not_globally_paused()?;
        let caller = self.vm().msg_sender();
        let pos = self.positions.getter(position_id);
        let owner = pos.owner.get();
        let agent = pos.agent.get(); // Phase 2a: read agent for record_close
        let is_user = caller == owner;
        let is_vigil = caller == self.vigil_address.get();
        if !is_user && !is_vigil {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }

        // Audit FIRE78-PLINTH-H1 fix (sub-agent HIGH): arm the is_updating
        // reentrancy guard BEFORE any external call (get_safe_price reads
        // Chainlink + Pyth via cross-contract). `docs/conventions/security.md`
        // requires every state-changing function on Plinth+Coffer to use
        // this pattern; close_position was the one outlier. open_position
        // arms it; close_position now does too. Released on the happy and
        // error paths via the explicit set/clear pair (Stylus doesn't have
        // a try/finally; we set false before each early return below).
        if self.is_updating.get() {
            return Err(PlinthError::code(ERR_REENTRANT));
        }
        self.is_updating.set(true);

        let entry_price = pos.entry_price_q64.get();
        let venue_id: u8 = pos.venue_id.get().to::<u8>();
        let instrument_id = pos.instrument_id.get();
        let notional = pos.notional_signed.get();

        let current_price = match self.get_safe_price(venue_id, instrument_id) {
            Ok(p) => p,
            Err(e) => {
                self.is_updating.set(false);
                return Err(e);
            }
        };
        // Inlined from math::compute_realized_pnl, math module gated to test
        // builds only. PnL = notional * (current - entry) / entry, with the
        // entire path saturating-arithmetic so no panic ever surfaces here.
        let realized_pnl = if entry_price.is_zero() {
            I256::ZERO
        } else {
            let entry_i = I256::try_from(entry_price).unwrap_or(I256::MAX);
            let current_i = I256::try_from(current_price).unwrap_or(I256::MAX);
            let delta = current_i.saturating_sub(entry_i);
            // Audit fix (#63): floor-divide so a losing position's booked loss is
            // never rounded toward zero (was `/ entry_i`, truncating).
            floor_div_i256(notional.saturating_mul(delta), entry_i)
        };

        // Remove from user list (linear scan, bounded by max_positions_per_user)
        let mut user_list = self.user_position_ids.setter(owner);
        let mut found = false;
        for i in 0..user_list.len() {
            if user_list.get(i).unwrap_or_default() == position_id {
                let last_idx = user_list.len() - 1;
                let last = user_list.get(last_idx).unwrap_or_default();
                user_list.setter(i).unwrap().set(last);
                user_list.pop();
                found = true;
                break;
            }
        }
        if !found {
            // Position already closed or never owned by this user; idempotent return
            self.is_updating.set(false);
            return Ok(I256::ZERO);
        }

        // Clear the position
        let mut pos_mut = self.positions.setter(position_id);
        pos_mut.notional_signed.set(I256::ZERO);
        pos_mut.owner.set(Address::ZERO);

        self.vm().log(PositionClosed {
            position_id,
            realized_pnl_signed: realized_pnl,
        });

        // Phase 2a: call Sigil.record_close to decrement agent's open notional.
        // Only if the position was opened by an agent (non-zero agent address).
        if !agent.is_zero() {
            let abs_notional = U256::try_from(notional.unsigned_abs()).unwrap_or(U256::ZERO);
            let sigil = ISigil::new(self.sigil_address.get());
            let sctx = Call::new_mutating(self);
            // Best-effort: if Sigil call fails, the position is still closed.
            // The agent's credit-line will be over-counted (fail-safe direction).
            let _ = sigil.record_close(self.vm(), sctx, agent, abs_notional);
        }

        // Release the guard BEFORE update_margin since that path takes the
        // guard itself (do_update_margin set elsewhere wraps its own).
        self.is_updating.set(false);
        self.update_margin(owner)?;
        Ok(realized_pnl)
    }

    /// Recompute margin for `user`. Atomic with Vigil trigger on shortfall.
    ///
    /// Access control: only owner, registered adapters, active keepers, or Praetor.
    /// External callers cannot grief-spam recomputation.
    pub fn update_margin(&mut self, user: Address) -> Result<U256, PlinthError> {
        self.assert_not_globally_paused()?;

        let caller = self.vm().msg_sender();
        let is_self = caller == user;
        let is_adapter = self.is_registered_adapter(caller);
        let is_vigil = caller == self.vigil_address.get();
        let is_praetor = caller == self.praetor_multisig.get();
        if !(is_self || is_adapter || is_vigil || is_praetor) {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }

        // Reentrancy guard
        if self.is_updating.get() {
            return Err(PlinthError::code(ERR_REENTRANT));
        }
        self.is_updating.set(true);

        let result = self.do_update_margin(user);

        self.is_updating.set(false);

        result
    }

    /// View: read-only account snapshot.
    pub fn get_account(&self, user: Address) -> (U256, U256, U256, bool) {
        let acc = self.accounts.getter(user);
        (
            acc.collateral_value_wei.get(),
            acc.required_margin_wei.get(),
            acc.margin_version.get(),
            acc.is_paused.get(),
        )
    }

    /// View: a single position.
    pub fn get_position(&self, position_id: U256) -> (Address, u8, FixedBytes<32>, I256, U256) {
        let p = self.positions.getter(position_id);
        (
            p.owner.get(),
            p.venue_id.get().to::<u8>(),
            p.instrument_id.get(),
            p.notional_signed.get(),
            p.entry_price_q64.get(),
        )
    }

    /// View: list of position ids for a user.
    pub fn get_user_positions(&self, user: Address) -> Vec<U256> {
        let list = self.user_position_ids.getter(user);
        let mut out = Vec::with_capacity(list.len());
        for i in 0..list.len() {
            if let Some(id) = list.get(i) {
                out.push(id);
            }
        }
        out
    }

    /// View: current margin_version (used by Vigil to check job freshness).
    pub fn get_margin_version(&self, user: Address) -> U256 {
        self.accounts.getter(user).margin_version.get()
    }

    // ===== Init-state getters (Audit 2026-05-24 G-2 fix) =====
    // `/api/deployments/status` reads these via viem to confirm initialize()
    // ran and that the wiring matches the registry. Stale-deploy guard.
    pub fn praetor_multisig(&self) -> Address {
        self.praetor_multisig.get()
    }

    pub fn praetor_timelock(&self) -> Address {
        self.praetor_timelock.get()
    }

    pub fn coffer_address(&self) -> Address {
        self.coffer_address.get()
    }

    pub fn vigil_address(&self) -> Address {
        self.vigil_address.get()
    }

    pub fn sigil_address(&self) -> Address {
        self.sigil_address.get()
    }

    /// Timelock-only: register or update instrument risk config.
    /// Audit F-32 fix: parameter changes must come from PraetorTimelock,
    /// not the multisig directly, so the 48h delay is enforced on-chain.
    pub fn set_instrument_risk(
        &mut self,
        venue_id: u8,
        instrument_id: FixedBytes<32>,
        haircut_bps: u16,
        correlation_class: u16,
        pyth_feed_id: FixedBytes<32>,
        chainlink_feed: Address,
        is_active: bool,
    ) -> Result<(), PlinthError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        // Audit PPP-8 fix: cap correlation_class against the SPAN evaluator's
        // hardcoded MAX_CORRELATION_CLASSES window. Without this, a Praetor
        // typo passing class=16+ creates an instrument whose positions
        // require ZERO margin, silent grant of unbounded leverage.
        // Phase 2a: also require correlation_class > 0. Class 0 is reserved
        // in PlinthMath as "each position is its own class" (no netting).
        // Instruments must be assigned to a real class (1..max_classes-1).
        let max_classes: u16 = self.params.max_correlation_classes.get().to::<u16>();
        if correlation_class == 0 || correlation_class >= max_classes {
            return Err(PlinthError::code(ERR_CORRELATION_CLASS_OOR));
        }
        let key = instrument_key(venue_id, instrument_id);
        let mut risk = self.instrument_risk.setter(key);
        risk.haircut_bps.set(Uint::<16, 1>::from(haircut_bps));
        risk.correlation_class.set(Uint::<16, 1>::from(correlation_class));
        risk.pyth_feed_id.set(pyth_feed_id);
        risk.chainlink_feed.set(chainlink_feed);
        risk.is_active.set(is_active);
        Ok(())
    }

    /// Emergency pause. Instant, no timelock for pauses per PRD §13.4 +
    /// TDD §7.10. Audit G-6 fix: accept caller in {multisig, timelock} so
    /// PraetorTimelock.emergencyPause (which forwards from multisig via
    /// `IPausable(target).pause(reason)`) actually reaches this function;
    /// previously the timelock-as-sender check failed and the documented
    /// emergency path reverted on every Atrium contract.
    pub fn pause(&mut self, reason: B256) -> Result<(), PlinthError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_multisig.get() && caller != self.praetor_timelock.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        self.is_global_paused.set(true);
        let block_now = self.vm().block_number();
        self.vm().log(PlinthPaused {
            reason,
            block_number: block_now,
        });
        Ok(())
    }

    /// Resume. Timelock-only, resuming a pause is a parameter change and
    /// gets the full 48h community-veto window.
    pub fn resume(&mut self) -> Result<(), PlinthError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        self.is_global_paused.set(false);
        self.vm().log(PlinthResumed {
            block_number: self.vm().block_number(),
        });
        Ok(())
    }

    /// Manually clear a single account's pause flag. Timelock-only escape
    /// hatch complementing the symmetric auto-heal in update_margin (audit
    /// blocker contracts-rust #1): the auto-heal clears is_paused whenever a
    /// recompute finds the account healthy, but this gives an explicit admin
    /// recovery path (and emits the previously-declared-but-never-emitted
    /// AccountResumed event) for any edge case where an account is stuck
    /// paused while genuinely solvent.
    pub fn resume_account(&mut self, user: Address) -> Result<(), PlinthError> {
        let caller = self.vm().msg_sender();
        if caller != self.praetor_timelock.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        {
            let mut acc = self.accounts.setter(user);
            acc.is_paused.set(false);
        }
        self.vm().log(AccountResumed { user });
        Ok(())
    }
}

// =============================================================================
// Internal helpers (not exposed via ABI)
// =============================================================================
impl Plinth {
    fn assert_not_globally_paused(&self) -> Result<(), PlinthError> {
        if self.is_global_paused.get() {
            return Err(PlinthError::code(ERR_GLOBALLY_PAUSED));
        }
        Ok(())
    }

    fn assert_account_not_paused(&self, user: Address) -> Result<(), PlinthError> {
        if self.accounts.getter(user).is_paused.get() {
            return Err(PlinthError::code(ERR_ACCOUNT_PAUSED));
        }
        Ok(())
    }

    fn is_registered_adapter(&self, addr: Address) -> bool {
        // External call to PorticoRegistry
        let registry = IPorticoRegistry::new(self.portico_registry_address.get());
        match registry.is_registered_adapter(self.vm(), Call::new(), addr) {
            Ok(b) => b,
            Err(_) => false,
        }
    }

    /// Resolve the effective owner of an action.
    /// If action_sigil is empty: caller must be the owner.
    /// If non-empty: Sigil validates the mandate; owner is recovered from the IntentSigil.
    fn resolve_owner(
        &mut self,
        caller: Address,
        action_sigil: &Bytes,
        intent_sigil: &Bytes,
    ) -> Result<Address, PlinthError> {
        if action_sigil.is_empty() && intent_sigil.is_empty() {
            return Ok(caller);
        }
        // Sigil.validateAction returns true if signatures + caps + expiry all pass.
        let sigil = ISigil::new(self.sigil_address.get());
        let action_vec: Vec<u8> = action_sigil.to_vec();
        let intent_vec: Vec<u8> = intent_sigil.to_vec();
        let sctx = Call::new_mutating(self);
        match sigil.validate_action(self.vm(), sctx, intent_vec.into(), action_vec.into()) {
            Ok(true) => {
                // Agent A audit M3 fix: owner is the FIRST 32 bytes of `intent_sigil`,
                // not `action_sigil`. The intent envelope is ABI-encoded with the
                // owner address in slot 0. Reading from action_sigil was a forgery
                // vector, caller-controlled action bytes could spoof the owner.
                if intent_sigil.len() < 32 {
                    return Err(PlinthError::code(ERR_INVALID_ACTION_SIGIL));
                }
                let owner_bytes: [u8; 32] = intent_sigil[0..32]
                    .try_into()
                    .unwrap_or([0u8; 32]);
                let mut addr_bytes = [0u8; 20];
                addr_bytes.copy_from_slice(&owner_bytes[12..32]);
                Ok(Address::from(addr_bytes))
            }
            _ => Err(PlinthError::code(ERR_INVALID_ACTION_SIGIL)),
        }
    }

    /// Dual-oracle median + tolerance check. Wave-A.7: implementation moved
    /// to the separate PlinthOracle Stylus contract to fit EIP-170. The
    /// hardening (negative-price refusal, decimals-read failure surfacing,
    /// freshness/tolerance checks) lives there now, Plinth just forwards.
    fn get_safe_price(
        &self,
        venue_id: u8,
        instrument_id: FixedBytes<32>,
    ) -> Result<U256, PlinthError> {
        let key = instrument_key(venue_id, instrument_id);
        let risk = self.instrument_risk.getter(key);

        let chainlink_feed = risk.chainlink_feed.get();
        let pyth_feed = risk.pyth_feed_id.get();
        let pyth_addr = self.pyth_oracle.get();
        let freshness: u64 = self.params.oracle_freshness_seconds.get().to::<u64>();
        let tolerance_bps: u16 = self.params.oracle_tolerance_bps.get().to::<u16>();

        let oracle = IPlinthOracle::new(self.plinth_oracle_address.get());
        oracle
            .safe_price(
                self.vm(),
                Call::new(),
                pyth_addr,
                chainlink_feed,
                pyth_feed,
                freshness,
                tolerance_bps,
            )
            // PlinthOracle reverts with OracleErr(uint16). We map all those
            // back to the matching ERR_* code on this side so external
            // decoders only see PlinthErr(code) regardless of which contract
            // raised it. ERR_ORACLE_STALE is the safest catch-all when the
            // decode fails, the failure mode for any oracle path is "do
            // not trust this price".
            .map_err(|_| PlinthError::code(ERR_ORACLE_STALE))
    }

    /// Actual margin recompute. Called inside the reentrancy guard.
    fn do_update_margin(&mut self, user: Address) -> Result<U256, PlinthError> {
        self.do_update_margin_with_kind(user, MarginCheckKind::Maintenance)
    }

    /// Phase 2a: margin recompute with kind parameter.
    /// When kind == Open, applies 1.5× initial margin multiplier so new
    /// positions must have 50% buffer above maintenance requirement.
    fn do_update_margin_with_kind(&mut self, user: Address, kind: MarginCheckKind) -> Result<U256, PlinthError> {
        // Read all positions and prices into parallel arrays. We pass these
        // over staticcall to PlinthMath (split out to fit EIP-170, see
        // Phase A.7 in LAUNCH_READY.md).
        let position_ids = self.get_user_positions(user);
        let mut notionals: Vec<I256> = Vec::with_capacity(position_ids.len());
        let mut entry_prices: Vec<U256> = Vec::with_capacity(position_ids.len());
        let mut current_prices: Vec<U256> = Vec::with_capacity(position_ids.len());
        let mut haircuts: Vec<u16> = Vec::with_capacity(position_ids.len());
        let mut classes: Vec<u16> = Vec::with_capacity(position_ids.len());
        for id in &position_ids {
            let p = self.positions.getter(*id);
            if !p.notional_signed.get().is_zero() {
                let price = self
                    .get_safe_price(p.venue_id.get().to::<u8>(), p.instrument_id.get())?;
                notionals.push(p.notional_signed.get());
                entry_prices.push(p.entry_price_q64.get());
                current_prices.push(price);
                haircuts.push(p.haircut_bps.get().to::<u16>());
                classes.push(p.correlation_class.get().to::<u16>());
            }
        }

        // Compute required margin via PlinthMath (separate Stylus contract
        // for code-size reasons). Static call, view function, no state
        // mutation on the math side.
        let math = IPlinthMath::new(self.plinth_math_address.get());
        let min_initial = self.params.min_initial_margin_bps.get().to::<u16>();
        let maint_buffer = self.params.maint_margin_buffer_bps.get().to::<u16>();
        // Audit fix (contracts-rust #8): PlinthMath.required_margin reverts
        // ArrayLengthMismatch on n==0. A fully-closed account - including the
        // moment you close your LAST position, which empties the list before
        // this recompute runs - would otherwise revert the whole
        // close_position / update_margin tx (and block Vigil from closing a
        // user's final position). span.rs already returns ZERO for empty; match
        // it here and skip the wasted staticcall.
        let mut required = if notionals.is_empty() {
            U256::ZERO
        } else {
            math
                .required_margin(
                    self.vm(),
                    Call::new(),
                    notionals,
                    entry_prices,
                    current_prices,
                    haircuts,
                    classes,
                    min_initial,
                    maint_buffer,
                )
                .map_err(|_| PlinthError::code(ERR_MATH_UNREACHABLE))?
        };

        // Phase 2a: apply initial margin multiplier at open time only.
        // This ensures new positions start with a 50% buffer above maintenance
        // margin, giving the system time for orderly liquidation if price moves
        // adversely immediately after opening.
        if kind == MarginCheckKind::Open {
            required = required
                .saturating_mul(U256::from(INITIAL_MARGIN_MULTIPLIER_BPS))
                / U256::from(10_000u64);
        }

        // Read Coffer balance.
        //
        // Audit OOO-2 fix: pre-fix `.unwrap_or(U256::ZERO)` would default the
        // user's collateral to 0 on any Coffer call failure. The very next
        // block (line below) compares `collateral < required`, if required
        // is non-zero, the user gets auto-paused and Vigil queues a
        // liquidation against a HEALTHY account whose Coffer view merely
        // hiccuped. Wrongful-liquidation trigger. Closes #28 family site 3.
        let coffer = ICoffer::new(self.coffer_address.get());
        // FUND-SAFETY FIX (2026-06-07 units audit): collateral must be the USDC
        // ASSET value, not the raw ERC-4626 share balance. coffer.balance_of
        // returns SHARES, which on a small vault are ~1e6x the assets (the
        // virtual-share offset). Comparing share-collateral against the asset-
        // denominated `required` below made every account read ~1e6x
        // over-collateralized, so the underwater gate + Vigil liquidation never
        // fired (undercollateralized positions un-liquidatable). Convert shares
        // to assets so the comparison is apples-to-apples (mirrors what
        // /app/vault and the portfolio routes already do).
        let shares = coffer
            .balance_of(self.vm(), Call::new(), user)
            .map_err(|_| PlinthError::code(ERR_COFFER_UNREACHABLE))?;
        let collateral = coffer
            .convert_to_assets(self.vm(), Call::new(), shares)
            .map_err(|_| PlinthError::code(ERR_COFFER_UNREACHABLE))?;

        // Bump margin_version
        let prev_version = self.accounts.getter(user).margin_version.get();
        let new_version = prev_version + U256::from(1);

        // Hoist VM reads before the `.setter()` mut borrow to avoid &self/&mut self conflicts.
        let block_now = self.vm().block_number();
        let underwater = collateral < required;

        // Persist, single mutable-borrow scope. All writes happen here so the
        // setter `acc` is released before we touch `self.vm()` or external
        // contracts below.
        {
            let mut acc = self.accounts.setter(user);
            acc.collateral_value_wei.set(collateral);
            acc.required_margin_wei.set(required);
            acc.last_update_block.set(Uint::<64, 1>::from(block_now));
            acc.margin_version.set(new_version);
            // Audit blocker fix (contracts-rust #1): the pause flag was a
            // one-way set (true on underwater, never cleared), so any transient
            // under-collateralization permanently froze the account AND its
            // Coffer funds (open_position + Coffer.withdraw/adapter_pull all
            // gate on is_paused) with no on-chain recovery. Now it tracks
            // health symmetrically: a recompute that finds the account healthy
            // (collateral >= required) clears it. This only clears when the
            // account is genuinely healthy, so it cannot race a still-needed
            // liquidation (which leaves `underwater` true). A manual
            // timelock-gated resume_account() below is the admin escape hatch.
            acc.is_paused.set(underwater);
        }

        self.vm().log(MarginUpdated {
            user,
            collateral_value_wei: collateral,
            required_margin_wei: required,
            margin_version: new_version,
            block_number: block_now,
        });

        // Trigger Vigil if under-collateralized
        if underwater {
            // keccak256("under-collateralized") precomputed.
            let reason = B256::from(alloy_primitives::hex!(
                "8843ed11574a8df8e0d2cb1ee99a3f1e6f7a47fa3a0d51a44c3bf42d0ba8d1ee"
            ));
            self.vm().log(AccountPaused { user, reason });
            // Audit AAA-1 fix: prior code did `let _ = vigil.queue_liquidation(...)`
            //, silently discarded the Result. If Vigil rejected the queue
            // (Vigil paused, version mismatch, keeper queue full), the
            // account paused but no liquidation job was ever created. The
            // user was frozen out forever with no enforcement path.
            //
            // Now: emit VigilQueueFailed on Err so off-chain monitors can
            // manually re-queue. We DON'T revert here because the account
            // is already paused (caller-observable state), reverting would
            // undo the pause and leave the user actively losing money on
            // a now-unenforced under-collateralized position. The event is
            // the contract's "ask for help" signal.
            let vigil = IVigil::new(self.vigil_address.get());
            let vctx = Call::new_mutating(self);
            if vigil.queue_liquidation(self.vm(), vctx, user, new_version).is_err() {
                self.vm().log(VigilQueueFailed {
                    user,
                    margin_version: new_version,
                });
            }
        }

        Ok(required)
    }

    /// Phase 2a: reduce a position by `reduction_bps` basis points.
    /// Called by Vigil for partial liquidation instead of full close.
    /// Returns the realized PnL on the reduced portion.
    pub fn reduce_position(&mut self, position_id: U256, reduction_bps: u16) -> Result<I256, PlinthError> {
        self.assert_not_globally_paused()?;
        let caller = self.vm().msg_sender();
        // Only Vigil can call reduce_position
        if caller != self.vigil_address.get() {
            return Err(PlinthError::code(ERR_UNAUTHORIZED));
        }
        if self.is_updating.get() {
            return Err(PlinthError::code(ERR_REENTRANT));
        }
        self.is_updating.set(true);

        let pos = self.positions.getter(position_id);
        let owner = pos.owner.get();
        let entry_price = pos.entry_price_q64.get();
        let venue_id: u8 = pos.venue_id.get().to::<u8>();
        let instrument_id = pos.instrument_id.get();
        let notional = pos.notional_signed.get();

        if owner.is_zero() || notional.is_zero() {
            self.is_updating.set(false);
            return Ok(I256::ZERO);
        }

        let current_price = match self.get_safe_price(venue_id, instrument_id) {
            Ok(p) => p,
            Err(e) => {
                self.is_updating.set(false);
                return Err(e);
            }
        };

        // Compute the reduction amount
        let reduction_notional = notional.saturating_mul(I256::try_from(reduction_bps as i64).unwrap_or(I256::ZERO))
            / I256::try_from(10_000i64).unwrap_or(I256::MAX);
        let remaining_notional = notional.saturating_sub(reduction_notional);

        // Compute realized PnL on the reduced portion
        let realized_pnl = if entry_price.is_zero() {
            I256::ZERO
        } else {
            let entry_i = I256::try_from(entry_price).unwrap_or(I256::MAX);
            let current_i = I256::try_from(current_price).unwrap_or(I256::MAX);
            let delta = current_i.saturating_sub(entry_i);
            // Audit fix (#63): floor-divide (was truncating `/ entry_i`).
            floor_div_i256(reduction_notional.saturating_mul(delta), entry_i)
        };

        // Update position with reduced notional
        let mut pos_mut = self.positions.setter(position_id);
        pos_mut.notional_signed.set(remaining_notional);

        self.vm().log(PositionClosed {
            position_id,
            realized_pnl_signed: realized_pnl,
        });

        self.is_updating.set(false);
        self.update_margin(owner)?;
        Ok(realized_pnl)
    }
}

// Helper: derive a single key from (venue_id, instrument_id).
// Audit G-7 fix: the previous version overwrote byte 0 of the instrument_id
// with venue_id, so two instruments differing only in their first byte
// collapsed to the same risk config (haircut, correlation class, oracle
// feeds). Now uses keccak(venue ‖ instrument) so the full 32-byte
// instrument_id contributes to the key.
fn instrument_key(venue_id: u8, instrument_id: FixedBytes<32>) -> FixedBytes<32> {
    let mut input = [0u8; 33];
    input[0] = venue_id;
    input[1..33].copy_from_slice(instrument_id.as_slice());
    alloy_primitives::keccak256(&input)
}
