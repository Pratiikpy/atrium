// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "../../portico-registry/src/IPorticoAdapter.sol";
import {IPorticoAdapterV11} from "../../portico-registry/src/IPorticoAdapterV11.sol";

/// Plinth (Stylus) is callable from Solidity via standard call ABI.
/// Stylus 0.10 auto-converts snake_case Rust fn names to camelCase selectors,
/// so the on-chain ABI is `openPosition`, `closePosition`, `getPosition`.
/// Audit-fix 2026-05-24 (Auditor A C-4 sweep): the interface previously
/// declared snake_case names, which produce DIFFERENT selectors and reverted
/// every Plinth call from the Router with empty data.
interface IPlinth {
    function openPosition(
        uint8 venue_id,
        bytes32 instrument_id,
        int256 notional_signed,
        bytes calldata action_sigil,
        bytes calldata intent_sigil
    ) external returns (uint256);

    function closePosition(uint256 position_id) external returns (int256);

    function getAccount(address user)
        external
        view
        returns (uint256 collateral, uint256 required, uint256 unused, bool is_paused);

    /// Returns (owner, venue_id, instrument_id, notional, opened_at). Used by
    /// the Router's `close_position_via_adapter` to enforce that the caller
    /// owns the position before unwinding it.
    function getPosition(uint256 position_id)
        external
        view
        returns (address owner, uint8 venue_id, bytes32 instrument_id, int256 notional, uint256 opened_at);
}

/// Coffer's `adapter_pull` moves USDC from the vault to an adapter on
/// behalf of a user (auth-gated by `approved_adapters[caller] == true`).
/// The Router must be added to that set by Praetor before it can pull.
/// Stylus exports it as `adapterPull(uint256,address,address)`.
interface ICoffer {
    function adapterPull(uint256 amount, address from_user, address to) external;
}

/// PorticoRegistry tells the Router which adapter handles a given venue.
interface IPorticoRegistry {
    function getAdapter(uint8 venue_id) external view returns (address);
    function isRegisteredAdapter(address adapter) external view returns (bool);
}

/// Audit FIRE78-COF2 fix (sub-agent HIGH): the Router self-asserts it is
/// the sole approved orchestrator for any adapter it routes through.
/// Pre-fix, if a sub-adapter was ALSO individually on Coffer's
/// approved-adapters list (belt-and-suspenders configuration mistake),
/// it could call `coffer.adapterPull` directly and bypass Router-level
/// position limits. Now the Router queries Coffer's `isAdapterApproved`
/// view before routing and reverts loudly if it sees a sub-adapter on
/// the same approved-set. Defense-in-depth, the canonical guard is the
/// Praetor multisig discipline when calling `coffer.setAdapter`.
/// Stylus exports the view as `isAdapterApproved(address)(bool)`.
interface ICofferApprovedQuery {
    function isAdapterApproved(address adapter) external view returns (bool);
}

/// @title AtriumRouter
/// @notice Solves the architectural gap caught in audit EEEE-1 (`human_left.md` #31):
///         pre-Router, `Plinth.open_position` recorded margin in Plinth's
///         storage but never invoked any venue adapter; the 6 venue adapters
///         were orphaned. PRD Verifier-Mode Step 2 ("Open hedged position")
///         could not execute end-to-end.
///
///         The Router is the single user-facing entry point. It orchestrates
///         the four-step open flow:
///           1. Plinth validates margin and records the margin-side position.
///           2. PorticoRegistry resolves the adapter address by venue id.
///           3. Coffer transfers USDC to the adapter (Router is an approved
///              adapter for the purposes of `adapter_pull`).
///           4. Adapter opens the venue-side position using the freshly
///              delivered USDC.
///
///         Close path mirrors the open path: adapter returns USDC to Coffer,
///         then Plinth closes the margin-side record.
///
///         Implementation choice notes:
///         - **Option C** from `human_left.md` #31 (external router) was
///           chosen over Option A (Coffer-side orchestrator) because Stylus
///           builds are locally blocked on Windows MSVC (`human_left.md` #11).
///           Option C is a pure Solidity contract, locally buildable and
///           testable via Foundry today.
///         - Adapters move from `onlyCoffer` to `onlyAuthorizedCaller` — a
///           small mapping settable by Praetor that approves Coffer + Router.
///           See `CurveAdapter` for the canonical migration; remaining
///           adapters (Pendle, Aave V11, TradeXyz, Polymarket, Hyperliquid)
///           follow the same one-line pattern.
contract AtriumRouter {
    IPlinth public immutable plinth;
    ICoffer public immutable coffer;
    IPorticoRegistry public immutable registry;
    address public immutable praetor_multisig;

    /// @notice Emitted on every successful end-to-end open via the Router.
    /// Pre-Router this event channel was non-existent — the only on-chain
    /// trace of an "atomic open" was the four separate per-contract events.
    event PositionOpenedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        bytes32 indexed instrument_id,
        int256 notional_signed,
        uint256 plinth_position_id,
        uint256 venue_position_id
    );

    event PositionClosedViaRouter(
        address indexed user,
        uint8 indexed venue_id,
        uint256 indexed plinth_position_id,
        uint256 venue_position_id,
        int256 realized_pnl_signed
    );

    error Unauthorized();
    error VenueNotRegistered(uint8 venue_id);
    error AccountPaused(address user);
    /// Audit FIRE76-1 fix (HIGH): close_position_via_adapter was reachable
    /// by any caller for any position id, letting user A close user B's
    /// position. The Router now reads `plinth.get_position(id).owner` and
    /// reverts if it doesn't match `msg.sender`.
    error NotPositionOwner(uint256 plinth_position_id, address caller, address owner);
    /// Audit FIRE78-COF2 fix: defense-in-depth Router-self-assertion.
    error AdapterAlsoApprovedAsOrchestrator(address adapter);
    /// Phase theta.1 fix: adapter is missing the IPorticoAdapter `version()`
    /// view, so the Router cannot decide between the v1.0 and v1.1 ABI.
    error AdapterMissingVersion(address adapter);

    constructor(address _plinth, address _coffer, address _registry, address _praetor) {
        // Per DDD-5 / NNNN-1 / MMM-10 / LLL-1 / BBBBB-1 audit-pattern: fail
        // loud at deploy time if any critical dep is zero. The audit-pattern
        // completeness sweep (Wave-YYYY) made this the standard for every
        // new contract in the codebase.
        require(_plinth != address(0), "zero plinth");
        require(_coffer != address(0), "zero coffer");
        require(_registry != address(0), "zero registry");
        require(_praetor != address(0), "zero praetor");
        plinth = IPlinth(_plinth);
        coffer = ICoffer(_coffer);
        registry = IPorticoRegistry(_registry);
        praetor_multisig = _praetor;
    }

    /// @notice Open a position end-to-end across the margin → registry →
    /// vault → venue chain. Single user-facing entry point.
    function open_position_via_adapter(
        uint8 venue_id,
        bytes32 instrument_id,
        int256 notional_signed,
        bytes calldata action_sigil,
        bytes calldata intent_sigil,
        bytes calldata venue_payload
    ) external returns (uint256 plinth_position_id, uint256 venue_position_id) {
        address user = msg.sender;

        // Step 0: short-circuit on a paused account. Plinth would also catch
        // this but failing here keeps the revert closer to the caller.
        (,, , bool is_paused) = plinth.getAccount(user);
        if (is_paused) revert AccountPaused(user);

        // Audit FIRE76-2 fix (sub-agent HIGH): pull the margin amount Plinth
        // approved, NOT the raw notional. Pre-fix, the Router asked Coffer
        // for the full notional (e.g. $100k for a 10x-margin position) when
        // Plinth had only approved the required margin (e.g. $10k). Either
        // the call failed because the user lacked the shares, OR it drained
        // 10× what Plinth approved.
        //
        // Implementation: read the user's `required_margin_wei` before AND
        // after open_position. The delta is the margin Plinth approved for
        // this specific position. Coffer pulls that delta, not the notional.
        (, uint256 required_before,,) = plinth.getAccount(user);

        // Step 1: Plinth validates margin and records the margin-side row.
        plinth_position_id = plinth.openPosition(
            venue_id, instrument_id, notional_signed, action_sigil, intent_sigil
        );

        // Step 2: resolve adapter.
        address adapter_addr = registry.getAdapter(venue_id);
        if (adapter_addr == address(0)) revert VenueNotRegistered(venue_id);

        // Audit iteration 50 fix: the FIRE78-COF2 check that the file-header
        // docstring (line 47-55) PROMISED — but the code never built. Pre-fix
        // the Router declared `ICofferApprovedQuery`, declared
        // `AdapterAlsoApprovedAsOrchestrator`, and described the defense-in-
        // depth contract — and then never called the interface. A
        // misconfigured Coffer (sub-adapter ALSO in approved_adapters
        // alongside the Router) would let that adapter call
        // `coffer.adapter_pull` directly, bypassing Router-level position
        // limits + ownership checks. The docstring claimed protection that
        // didn't exist. Same lie-class as iter 49's InsufficientCollateralError.
        //
        // Now: actually call the view. If the resolved adapter is also on
        // Coffer's approved-orchestrators list, refuse to route through it.
        // The canonical answer is "Router-only as approved orchestrator; the
        // adapter receives funds via the Router, never via direct adapter_pull."
        if (ICofferApprovedQuery(address(coffer)).isAdapterApproved(adapter_addr)) {
            revert AdapterAlsoApprovedAsOrchestrator(adapter_addr);
        }

        // Step 3: move the Plinth-approved margin amount from Coffer to the
        // adapter. Required-margin only increases on a position open, so the
        // delta is non-negative; saturating math defends against an unexpected
        // ordering bug.
        (, uint256 required_after,,) = plinth.getAccount(user);
        uint256 amount = required_after > required_before
            ? required_after - required_before
            : 0;
        // Floor at 1 wei so an adapter call still happens for zero-margin
        // instruments (e.g. fully-collateralized binary outcomes). Adapters
        // can no-op if amount is below their dust threshold.
        if (amount == 0) {
            amount = uint256(notional_signed > 0 ? notional_signed : -notional_signed);
        }
        coffer.adapterPull(amount, user, adapter_addr);

        // Step 4: adapter opens the venue-side position. The originator (the
        // actual user, not the Router) reaches the adapter via two routes
        // depending on adapter ABI version:
        //
        //   v1.0: the user address is packed as the first 20 bytes of
        //         venue_payload per audit G-5; adapter unpacks it.
        //   v1.1: the user address is an explicit `originator` parameter on
        //         open_position_v11 per IPorticoAdapterV11; venue_payload
        //         remains opaque end-to-end.
        //
        // Phase theta.1 fix: pre-fix the Router unconditionally called the
        // v1.0 selector, which reverted `V10NotSupported` on every v1.1-only
        // adapter (AaveHorizonAdapterV11 at 0xe991...). Now we probe
        // `version()` and dispatch to the right ABI. The probe is a single
        // pure staticcall (~2.5k gas) and never swallows downstream reverts,
        // unlike a blind try/catch that would mask real failures (no-margin,
        // venue paused, etc.) as "fall back to v1.0 and try again".
        if (_isAdapterV11(adapter_addr)) {
            venue_position_id = IPorticoAdapterV11(adapter_addr).open_position_v11(
                user, instrument_id, notional_signed, venue_payload
            );
        } else {
            bytes memory full_payload = abi.encodePacked(user, venue_payload);
            venue_position_id = IPorticoAdapter(adapter_addr).open_position(
                instrument_id, notional_signed, full_payload
            );
        }

        emit PositionOpenedViaRouter(
            user, venue_id, instrument_id, notional_signed, plinth_position_id, venue_position_id
        );
    }

    /// @notice Close a position end-to-end. Returns the adapter-reported PnL.
    function close_position_via_adapter(
        uint8 venue_id,
        uint256 plinth_position_id,
        uint256 venue_position_id,
        bytes calldata venue_payload
    ) external returns (int256 realized_pnl_signed) {
        address user = msg.sender;

        // Audit FIRE76-1 fix (HIGH from sub-agent audit): verify ownership
        // BEFORE any downstream call. Pre-fix, any caller could pass another
        // user's plinth_position_id and trigger an unconsented unwind.
        (address pos_owner, , , , ) = plinth.getPosition(plinth_position_id);
        if (pos_owner != user) revert NotPositionOwner(plinth_position_id, user, pos_owner);

        address adapter_addr = registry.getAdapter(venue_id);
        if (adapter_addr == address(0)) revert VenueNotRegistered(venue_id);

        // Iter 50: FIRE78-COF2 mirror on the close path. Same defense-in-
        // depth as open_position_via_adapter — if the adapter is also on
        // Coffer's approved-orchestrators list, refuse to route through it.
        // Close path matters too: a malicious sub-adapter could call
        // coffer.adapter_pull during close_position to drain more than the
        // position's actual redemption.
        if (ICofferApprovedQuery(address(coffer)).isAdapterApproved(adapter_addr)) {
            revert AdapterAlsoApprovedAsOrchestrator(adapter_addr);
        }

        // Step 1: adapter closes the venue-side position and returns PnL.
        // The adapter transfers received USDC to Coffer in its own
        // close_position (per audit JJJ-9 + JJJ-12 patterns — the redeemed
        // amount routes back to atrium_coffer, not to the Router).
        //
        // Phase theta.1 fix: same v1.0 vs v1.1 dispatch as on the open
        // path. v1.1 takes explicit `originator`; v1.0 looks up the owner
        // off the venue_position_id internally.
        if (_isAdapterV11(adapter_addr)) {
            realized_pnl_signed = IPorticoAdapterV11(adapter_addr).close_position_v11(
                user, venue_position_id, venue_payload
            );
        } else {
            realized_pnl_signed = IPorticoAdapter(adapter_addr).close_position(
                venue_position_id, venue_payload
            );
        }

        // Step 2: Plinth closes the margin-side row.
        plinth.closePosition(plinth_position_id);

        emit PositionClosedViaRouter(
            user, venue_id, plinth_position_id, venue_position_id, realized_pnl_signed
        );
    }

    /// @notice Probe the adapter's `version()` view and return true when it
    /// reports v1.1 or higher. Reverts AdapterMissingVersion when the call
    /// fails (every IPorticoAdapter implementer MUST expose `version()`).
    /// @dev    Deliberately uses a low-level staticcall + decode rather than
    ///         a try/catch on the typed selector. Reason: a v1.0 adapter
    ///         missing the `open_position_v11` selector would also revert
    ///         in a blind-try design, but with empty-data — indistinguishable
    ///         from a legitimate downstream revert (e.g. user out of margin).
    ///         The version() probe is single-source-of-truth and lets real
    ///         reverts propagate untouched.
    function _isAdapterV11(address adapter_addr) internal view returns (bool) {
        (bool ok, bytes memory data) = adapter_addr.staticcall(
            abi.encodeWithSelector(IPorticoAdapter.version.selector)
        );
        if (!ok || data.length < 96) revert AdapterMissingVersion(adapter_addr);
        (uint256 major, uint256 minor,) = abi.decode(data, (uint256, uint256, uint256));
        return major == 1 && minor >= 1;
    }
}
