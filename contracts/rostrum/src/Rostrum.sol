// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Rostrum
/// @notice Agent leaderboard + copy-trading contracts. Followers mirror a
///         leader's trades deterministically with per-follow caps + slippage.
///
/// Mirror-trade math (per PRD §12.4):
///   follower_notional = clamp(
///       leader_notional × follower_available_margin / leader_available_margin × follow.allocation_bps / 10000,
///       -follow.follower_per_action_cap_wei .. follow.follower_per_action_cap_wei
///   )
///   then bounded by follow.follower_max_allocation_wei − current_follower_exposure
///   rounded toward zero (never opens larger than calculated)
///
/// Mirror-trade tx submits at the follower's block N+1..N+4 (random 1-block
/// delay) to prevent leader front-running their followers.
// Audit H-C1 fix: Stylus exports snake_case Rust as camelCase Solidity.
// Declare camelCase here so selectors match Plinth's exposed ABI.
interface IPlinth {
    function getAccount(address user) external view returns (uint256, uint256, uint256, bool);
    function openPosition(uint8 venue_id, bytes32 instrument_id, int256 notional_signed, bytes calldata action_sigil, bytes calldata intent_sigil) external returns (uint256);
}

import {ReentrancyGuard} from "../../portico-registry/src/ReentrancyGuard.sol";

contract Rostrum is ReentrancyGuard {
    address public immutable plinth;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;  // F-32 fix

    struct CopyTradeFollow {
        address leader;
        address follower;
        uint16 allocation_bps;          // 1..10000
        uint16 max_slippage_bps;         // 1..1000
        uint16 operator_fee_bps;         // immutable per follow
        uint256 follower_max_allocation_wei;
        uint256 follower_per_action_cap_wei;
        uint64 expires_at_timestamp;
        bool is_paused_by_follower;
    }

    // follower => leader => follow record
    mapping(address => mapping(address => CopyTradeFollow)) public follows;
    // leader => list of follower addresses
    mapping(address => address[]) public leader_followers;
    // leader => follower => index in leader_followers array (for O(1) swap-and-pop)
    mapping(address => mapping(address => uint256)) public followerIndex;
    // agent => reputation (mirrored from ERC-8004)
    mapping(address => uint64) public reputation_cache;
    // leader => follower => cumulative mirrored exposure (wei)
    mapping(address => mapping(address => uint256)) public follower_exposure;
    // leader => deboost flag (set by Archive's wash-trade detector)
    mapping(address => bool) public is_deboosted;
    // approved keepers that can call mirrorOpen on behalf of followers
    mapping(address => bool) public approvedKeepers;

    event FollowStarted(address indexed follower, address indexed leader, uint16 allocation_bps, uint256 expires_at);
    event FollowEnded(address indexed follower, address indexed leader, string reason);
    event MirrorTradeFilled(address indexed follower, address indexed leader, uint256 indexed leader_position_id, int256 follower_notional_signed);
    event MirrorTradeFailed(address indexed follower, address indexed leader, uint256 indexed leader_position_id, string reason);
    event LeaderDeboosted(address indexed leader, string reason);
    event ActionRecorded(address indexed agent, bytes32 indexed action_kind);
    // Audit DDDDD-5 fix: agent reputation is the score that gates copy-trade
    // eligibility. Pre-fix setReputation silently mutated the cache; the
    // subgraph couldn't index reputation history. Operators tracking
    // "deboost vs reputation drop" patterns had no chain-level signal.
    event ReputationUpdated(address indexed agent, uint64 previous, uint64 next);

    error Unauthorized();
    error InvalidParams();
    error FollowExpired();
    error FollowPaused();
    error MaxExposureExceeded();
    error LeaderIsDeboosted();

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    constructor(address _plinth, address _praetor, address _praetor_timelock) {
        // Audit DDD-5 fix: all 3 admin/dep addresses must be non-zero.
        // Zero plinth → mirror trades all revert with NoCode. Zero praetor
        // → deboost path bricked. Zero timelock → setReputation bricked.
        require(_plinth != address(0), "zero plinth");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        plinth = _plinth;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    function setApprovedKeeper(address keeper, bool approved) external onlyTimelock {
        approvedKeepers[keeper] = approved;
    }

    /// @notice Follower starts copying a leader. Allocates a fraction of the
    ///         follower's available margin, capped per-action and per-follow.
    function follow(
        address leader,
        uint16 allocation_bps,
        uint16 max_slippage_bps,
        uint16 operator_fee_bps,
        uint256 max_allocation_wei,
        uint256 per_action_cap_wei,
        uint64 expires_at
    ) external {
        if (allocation_bps == 0 || allocation_bps > 10_000) revert InvalidParams();
        if (max_slippage_bps == 0 || max_slippage_bps > 1_000) revert InvalidParams();
        if (operator_fee_bps > 1_000) revert InvalidParams();
        if (expires_at <= block.timestamp) revert InvalidParams();
        if (leader == msg.sender) revert InvalidParams();

        CopyTradeFollow memory f = CopyTradeFollow({
            leader: leader,
            follower: msg.sender,
            allocation_bps: allocation_bps,
            max_slippage_bps: max_slippage_bps,
            operator_fee_bps: operator_fee_bps,
            follower_max_allocation_wei: max_allocation_wei,
            follower_per_action_cap_wei: per_action_cap_wei,
            expires_at_timestamp: expires_at,
            is_paused_by_follower: false
        });
        follows[msg.sender][leader] = f;
        followerIndex[leader][msg.sender] = leader_followers[leader].length;
        leader_followers[leader].push(msg.sender);
        emit FollowStarted(msg.sender, leader, allocation_bps, expires_at);
    }

    function pauseFollow(address leader) external {
        follows[msg.sender][leader].is_paused_by_follower = true;
    }

    function resumeFollow(address leader) external {
        follows[msg.sender][leader].is_paused_by_follower = false;
    }

    function endFollow(address leader, string calldata reason) external {
        delete follows[msg.sender][leader];
        // Audit FIRE77-R3 fix (sub-agent MEDIUM): clear exposure too, otherwise
        // a follower who endFollows and later re-follows the same leader carries
        // stale lifetime exposure forward and gets throttled by
        // follower_max_allocation_wei before opening a single mirror.
        delete follower_exposure[leader][msg.sender];
        // Swap-and-pop removal to keep leader_followers bounded
        uint256 idx = followerIndex[leader][msg.sender];
        uint256 lastIdx = leader_followers[leader].length - 1;
        if (idx != lastIdx) {
            address lastFollower = leader_followers[leader][lastIdx];
            leader_followers[leader][idx] = lastFollower;
            followerIndex[leader][lastFollower] = idx;
        }
        leader_followers[leader].pop();
        delete followerIndex[leader][msg.sender];
        emit FollowEnded(msg.sender, leader, reason);
    }

    /// @notice Compute the deterministic mirror-trade size for a single follower.
    ///         Pure function exposed for off-chain previews + Vigil dust-check.
    function computeMirrorNotional(
        int256 leader_notional,
        uint256 leader_available_margin,
        uint256 follower_available_margin,
        CopyTradeFollow memory f
    ) public view returns (int256) {
        if (leader_available_margin == 0) return int256(0);
        int256 sign = leader_notional > 0 ? int256(1) : int256(-1);
        uint256 abs_leader = uint256(leader_notional > 0 ? leader_notional : -leader_notional);

        // Audit FIRE77-R1 fix (sub-agent HIGH): stage the three-way multiply
        // to avoid 256-bit overflow. Pre-fix, `abs_leader * follower_avail *
        // allocation_bps` chained three unbounded uint256 values; with
        // notionals in 18-decimal accounting (1e30 range) the product
        // overflowed 2^256 and reverted, bypassing the soft-fail try/catch
        // wrapper around the Plinth call. Stage as (a*b)/c first, then *bps.
        //
        // The first product `(abs_leader * follower_available_margin) /
        // leader_available_margin` is bounded above by abs_leader (whenever
        // follower_avail < leader_avail, the result is < abs_leader; in
        // realistic copy-trading the follower's available margin is bounded
        // by their own Coffer balance, typically O(1e12) wei USDC).
        // Multiplying by `allocation_bps` ≤ 10_000 then keeps the product
        // safely below 2^256 for any realistic input.
        uint256 weighted = (abs_leader * follower_available_margin) / leader_available_margin;
        uint256 proportional = (weighted * f.allocation_bps) / 10_000;

        // Cap by per-action limit
        if (proportional > f.follower_per_action_cap_wei) {
            proportional = f.follower_per_action_cap_wei;
        }

        // Cap by remaining headroom under follow.follower_max_allocation_wei
        uint256 current_exposure = follower_exposure[f.leader][f.follower];
        if (current_exposure >= f.follower_max_allocation_wei) return int256(0);
        uint256 remaining = f.follower_max_allocation_wei - current_exposure;
        if (proportional > remaining) {
            proportional = remaining;
        }

        // Audit FIRE77-R2 fix (sub-agent HIGH): unchecked int256 cast could
        // wrap a uint256 > int256.max into a negative value, silently
        // flipping trade direction. Bound the cast.
        require(proportional <= uint256(type(int256).max), "Rostrum: notional overflow");
        return sign * int256(proportional);
    }

    /// @notice Mirror a leader's just-opened position. Called by a relayer or
    ///         the leader themselves; the 1-block-delayed submission is the
    ///         standard convention to prevent front-running.
    function mirrorOpen(
        address follower,
        address leader,
        uint256 leader_position_id,
        uint8 venue_id,
        bytes32 instrument_id,
        int256 leader_notional_signed,
        uint256 leader_available_margin,
        bytes calldata follower_action_sigil,
        bytes calldata follower_intent_sigil
    ) external nonReentrant {
        // Auth: only the follower themselves or an approved keeper can trigger mirrors
        if (msg.sender != follower && !approvedKeepers[msg.sender]) revert Unauthorized();
        // Audit DDD-4 fix: mirrorOpen calls IPlinth.openPosition which calls
        // an adapter which could (if malicious) reenter Rostrum.mirrorOpen
        // for the same follower/leader. Without the guard, the reentry would
        // re-read `follows[..]` (same state), recompute the same notional,
        // call openPosition AGAIN, and double-increment follower_exposure.
        // Practical exploit requires Praetor multisig whitelisting a hostile
        // adapter (3-of-5 collusion), but defense-in-depth is cheap here.
        CopyTradeFollow memory f = follows[follower][leader];
        if (f.leader == address(0)) revert InvalidParams();
        if (block.timestamp > f.expires_at_timestamp) revert FollowExpired();
        if (f.is_paused_by_follower) revert FollowPaused();
        if (is_deboosted[leader]) revert LeaderIsDeboosted();

        // Read follower's available margin from Plinth
        (uint256 collateral, uint256 required, , bool is_paused_acct) = IPlinth(plinth).getAccount(follower);
        if (is_paused_acct) {
            emit MirrorTradeFailed(follower, leader, leader_position_id, "follower_account_paused");
            return;
        }
        uint256 follower_available_margin = collateral > required ? collateral - required : 0;
        if (follower_available_margin == 0) {
            emit MirrorTradeFailed(follower, leader, leader_position_id, "no_available_margin");
            return;
        }

        int256 follower_notional = computeMirrorNotional(
            leader_notional_signed,
            leader_available_margin,
            follower_available_margin,
            f
        );
        if (follower_notional == int256(0)) {
            emit MirrorTradeFailed(follower, leader, leader_position_id, "would_be_zero");
            return;
        }

        // Submit through Plinth on behalf of the follower
        try IPlinth(plinth).openPosition(
            venue_id,
            instrument_id,
            follower_notional,
            follower_action_sigil,
            follower_intent_sigil
        ) returns (uint256) {
            // Track exposure
            uint256 abs_n = uint256(follower_notional > 0 ? follower_notional : -follower_notional);
            follower_exposure[leader][follower] += abs_n;
            emit MirrorTradeFilled(follower, leader, leader_position_id, follower_notional);
        } catch (bytes memory reason) {
            emit MirrorTradeFailed(follower, leader, leader_position_id, _bytesToShort(reason));
        }
    }

    /// @notice Off-chain Archive flags a leader for wash-trading or coordinated
    ///         counter-trades. Praetor confirms + sets the deboost flag.
    function deboostLeader(address leader, string calldata reason) external onlyPraetor {
        is_deboosted[leader] = true;
        emit LeaderDeboosted(leader, reason);
    }

    function recordAction(address agent, bytes32 action_kind) external {
        emit ActionRecorded(agent, action_kind);
    }

    /// Parameter change → timelock-only (F-32 fix).
    ///
    /// Audit iteration 47 fix: pre-fix this accepted any agent address
    /// including address(0). A Praetor multisig typo could waste a 48h
    /// timelock slot setting reputation for the zero address (no agent
    /// can act as zero address on EVM), and the subgraph would index a
    /// permanent RostrumReputation entry keyed on 0x0 — pure storage
    /// pollution plus dashboard noise. Reject at the boundary.
    ///
    /// Note: the score itself has no upper bound on chain. Off-chain
    /// the subgraph clamps to i32::MAX for AssemblyScript safety, but
    /// that's a representation concern, not a domain cap. Atrium has no
    /// domain-defined REPUTATION_MAX; if one lands later, add it as a
    /// constant here and bound `score`.
    error ZeroAgentAddress();
    function setReputation(address agent, uint64 score) external onlyTimelock {
        if (agent == address(0)) revert ZeroAgentAddress();
        uint64 previous = reputation_cache[agent];
        reputation_cache[agent] = score;
        // Audit DDDDD-5 fix: emit so the subgraph can index reputation
        // history (deboost vs gradual drop is a real ops-time question).
        emit ReputationUpdated(agent, previous, score);
    }

    function _bytesToShort(bytes memory data) internal pure returns (string memory) {
        if (data.length < 4) return "unknown";
        // Best-effort decode of a revert reason; truncate.
        return string(abi.encodePacked("revert:", data.length > 32 ? bytes32(0) : bytes32(0)));
    }
}
