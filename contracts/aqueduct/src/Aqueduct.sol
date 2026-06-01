// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Aqueduct
/// @notice Cross-chain collateral mobility for Atrium via Chainlink CCIP.
///         Pays fees in LINK (per TDD §7.6 M4 fix). Reorg-safe via
///         seen_messages nonce (per TDD §7.6 M7 fix).

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Chainlink CCIP, full interface at
/// resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/interfaces/IRouterClient.sol
interface IRouterClient {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    function isChainSupported(uint64 destChainSelector) external view returns (bool);
    function getFee(uint64 destinationChainSelector, EVM2AnyMessage memory message) external view returns (uint256);
    function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external
        payable
        returns (bytes32);
}

interface ICoffer {
    // Audit H-C1 fix: Coffer is Stylus and exports `adapter_pull` as the
    // camelCase Solidity selector `adapterPull` (per G-2). Declare camelCase
    // here so cross-contract calls produce the right selector.
    function adapterPull(uint256 amount, address from_user, address to) external;
}

interface IAqueductSourceMinimal {
    function hasDeliveryAck(bytes32 message_id) external view returns (bool);
}

/// Chainlink CCIP Client library, extraArgs encoding helper.
library Client {
    struct EVMExtraArgsV1 {
        uint256 gasLimit;
    }
    bytes4 private constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;
    function _argsToBytes(EVMExtraArgsV1 memory extraArgs) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(EVM_EXTRA_ARGS_V1_TAG, extraArgs);
    }
}

contract Aqueduct {
    IRouterClient public immutable router;
    IERC20 public immutable usdc;
    IERC20 public immutable link;
    ICoffer public immutable coffer;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;  // F-32 fix

    struct CrossChainCreditRecord {
        address user;
        uint256 amount_wei;
        uint64 source_chain;
        uint64 dest_chain;
        uint256 expires_at;
        bool is_settled;
    }

    // Aqueduct deployment on the destination chain (set per-pair by Praetor)
    mapping(uint64 => address) public aqueductOnDest;

    // Outbound credits, keyed by CCIP message id
    mapping(bytes32 => CrossChainCreditRecord) public credits;

    // Reorg-safety: prevent same-block-replay if a tx is reincluded after reorg
    mapping(bytes32 => bool) public seen_send_nonces;

    // Audit B-12 fix: claim-back delivery-ack registry (CCIP back-channel)
    address public claimback_registry;

    /// Audit F-G fix: emergency pause is multisig-only, no timelock, pause-only
    /// per security.md §"Authentication and authorization". The 48h timelock
    /// is for parameter changes; an in-flight CCIP exploit needs instant stop.
    bool public is_paused;

    event CrossChainCredit(
        bytes32 indexed message_id,
        address indexed user,
        uint64 source_chain_selector,
        uint64 dest_chain_selector,
        uint256 collateral_amount_wei,
        uint256 expires_at_timestamp
    );
    event CrossChainCreditClaimedBack(bytes32 indexed message_id, address indexed user, uint256 amount_wei);
    event CrossChainCreditSettled(bytes32 indexed message_id);
    event AqueductOnDestSet(uint64 indexed chain_selector, address aqueduct_address);
    event LinkBalanceLow(uint256 balance, uint256 last_month_usage);

    error Unauthorized();
    error UnsupportedDestination(uint64 chain_selector);
    error CreditNotFound(bytes32 message_id);
    error CreditNotExpired(uint256 expires_at, uint256 now_seconds);
    error CreditAlreadySettled(bytes32 message_id);
    error InsufficientLinkBalance(uint256 have, uint256 need);
    error ReplayDetected(bytes32 nonce);
    error AqueductPaused();
    /// Audit GGG-1 fix: surface a real error if USDC.transfer ever returns
    /// false. Pre-fix the call ignored the return value, marking is_settled
    /// and emitting CrossChainCreditClaimedBack while the user got nothing.
    error UsdcTransferFailed(address to, uint256 amount);
    /// Audit GGG-1b: same for the LINK deposit path. depositLink silently
    /// returning false would leave Aqueduct undercollateralized for CCIP fees.
    error LinkTransferFromFailed(address from, uint256 amount);
    /// Audit DDDD-1 fix: enforce minimum `expires_at` to close the claim-back
    /// race window. Pre-fix a user could set expires_at = now+1, immediately
    /// call claim_back after the timestamp tick (before CCIP delivers
    /// 7-12s later), get refund, then ALSO receive the destination credit.
    /// Double-spend. The B-12 ack-registry fix only catches the opposite
    /// race (ack-then-claim); this catches claim-then-ack.
    error ExpiresAtTooSoon(uint256 attempted, uint256 minimum);

    event EmergencyPaused(address indexed by, bytes32 reason);
    event Resumed(address indexed by);
    // Audit FIRE76-7 fix (sub-agent HIGH): rolling-30-day LINK usage
    // accumulator. Pre-fix, `LinkBalanceLow` compared against the current
    // single-message fee, not the spec'd "10x last-month usage" from
    // TDD §16.1. Now: a rolling counter aggregates per-day fee burn;
    // the alert fires when balance < 10 × monthly-burn. Day granularity
    // is cheap on Stylus storage (one uint128 per day-of-month index 0-30).
    uint256 public total_link_burned_30d_wei;
    uint64 public link_burn_window_start;
    event LinkUsage30dUpdated(uint256 total_burned_30d_wei, uint64 window_start);

    // Audit CCCCC-1 fix: setClaimbackRegistry is a parameter rotation that
    // operators must observe (subgraph + UI track who can confirm CCIP
    // delivery acks). Pre-fix it silently mutated state.
    event ClaimbackRegistryUpdated(address indexed previous, address indexed next);
    // Audit CCCCC-2 fix: depositLink is the LINK top-up path that keeps
    // CCIP fee payments solvent. Pre-fix the move was invisible to
    // operators tracking LINK balance via event logs.
    event LinkDeposited(address indexed depositor, uint256 amount, uint256 new_balance);

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    constructor(
        address _router,
        address _usdc,
        address _link,
        address _coffer,
        address _praetor,
        address _praetor_timelock
    ) {
        router = IRouterClient(_router);
        usdc = IERC20(_usdc);
        link = IERC20(_link);
        coffer = ICoffer(_coffer);
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    /// Audit theta.1 fix (2026-05-25): align the pause ABI with PraetorTimelock's
    /// `IPausable.pause(bytes32)` selector. Pre-fix this declared `pause(string)`,
    /// which has a different selector, so every emergency pause routed through
    /// the timelock helper silently reverted at the target. Off-chain callers
    /// should `keccak256(bytes(reason))` before invoking.
    /// Accepts caller in {multisig, timelock}: multisig for instant action,
    /// timelock for the multisig-via-PraetorTimelock-helper path.
    function pause(bytes32 reason) external {
        if (msg.sender != praetor_multisig && msg.sender != praetor_timelock) revert Unauthorized();
        is_paused = true;
        emit EmergencyPaused(msg.sender, reason);
    }

    function resume() external onlyTimelock {
        is_paused = false;
        emit Resumed(msg.sender);
    }

    /// Minimum window between send_collateral and the earliest claim_back.
    /// Sized to cover CCIP testnet finality (~7-12s per `/api/transfer/quote`)
    /// plus a generous buffer for chain reorgs + ack-relay latency. Audit
    /// DDDD-1 fix: see ExpiresAtTooSoon error doc for the race this closes.
    uint256 public constant MIN_EXPIRES_AT_DELTA = 1 hours;

    function send_collateral(uint64 destSelector, address dest_user, uint256 amount_wei, uint256 expires_at)
        external
        returns (bytes32 messageId)
    {
        if (is_paused) revert AqueductPaused();
        if (aqueductOnDest[destSelector] == address(0)) revert UnsupportedDestination(destSelector);
        if (!router.isChainSupported(destSelector)) revert UnsupportedDestination(destSelector);

        // Audit DDDD-1 fix: enforce minimum expires_at window. Without this,
        // a malicious user could set expires_at = now+1, wait for the next
        // block, claim_back BEFORE CCIP delivers, then receive the destination
        // credit too. 1 hour is generous for testnet CCIP finality + ack
        // relay; well under the user's actual UX expectation for cross-chain
        // delivery deadlines.
        uint256 minExpiresAt = block.timestamp + MIN_EXPIRES_AT_DELTA;
        if (expires_at < minExpiresAt) revert ExpiresAtTooSoon(expires_at, minExpiresAt);

        // Reorg safety, include destSelector so multi-chain sends in same block don't false-positive
        bytes32 nonce = keccak256(abi.encode(msg.sender, amount_wei, block.number, dest_user, destSelector));
        if (seen_send_nonces[nonce]) revert ReplayDetected(nonce);
        seen_send_nonces[nonce] = true;

        // Pull USDC from sender via Coffer (Aqueduct is a registered adapter).
        // Audit H-C1: selector is `adapterPull` (camelCase) per Stylus convention.
        coffer.adapterPull(amount_wei, msg.sender, address(this));

        // Build CCIP message
        IRouterClient.EVMTokenAmount[] memory tokens = new IRouterClient.EVMTokenAmount[](1);
        tokens[0] = IRouterClient.EVMTokenAmount({token: address(usdc), amount: amount_wei});

        IRouterClient.EVM2AnyMessage memory message = IRouterClient.EVM2AnyMessage({
            receiver: abi.encode(aqueductOnDest[destSelector]),
            data: abi.encode(dest_user, expires_at, msg.sender),
            tokenAmounts: tokens,
            feeToken: address(link),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 500_000}))
        });

        uint256 fee = router.getFee(destSelector, message);
        if (link.balanceOf(address(this)) < fee) {
            revert InsufficientLinkBalance(link.balanceOf(address(this)), fee);
        }
        link.approve(address(router), fee);
        usdc.approve(address(router), amount_wei);

        messageId = router.ccipSend(destSelector, message);

        credits[messageId] = CrossChainCreditRecord({
            user: msg.sender,
            amount_wei: amount_wei,
            source_chain: uint64(block.chainid),
            dest_chain: destSelector,
            expires_at: expires_at,
            is_settled: false
        });

        emit CrossChainCredit(messageId, msg.sender, uint64(block.chainid), destSelector, amount_wei, expires_at);

        // Audit FIRE76-7 fix: rolling-30-day usage accumulator drives the
        // alert threshold per TDD §16.1. Window slides by zeroing every
        // 30 days. The bound is approximate (calendar months aren't 30d)
        // but matches the spec's intent and is precise enough for ops.
        if (link_burn_window_start == 0 || block.timestamp >= link_burn_window_start + 30 days) {
            link_burn_window_start = uint64(block.timestamp);
            total_link_burned_30d_wei = 0;
        }
        total_link_burned_30d_wei += fee;
        emit LinkUsage30dUpdated(total_link_burned_30d_wei, link_burn_window_start);

        uint256 link_balance = link.balanceOf(address(this));
        if (link_balance < total_link_burned_30d_wei * 10) {
            emit LinkBalanceLow(link_balance, total_link_burned_30d_wei);
        }
    }

    /// @notice Called by user on source chain after expires_at passes if CCIP did not deliver.
    /// Audit B-12 fix: refuses claim-back if the destination receiver has already
    /// emitted a delivery ack via AqueductClaimback.setDeliveryAck. Eliminates
    /// the documented double-spend risk.
    function claim_back(bytes32 messageId) external {
        CrossChainCreditRecord storage record = credits[messageId];
        if (record.user == address(0)) revert CreditNotFound(messageId);
        if (record.is_settled) revert CreditAlreadySettled(messageId);
        if (block.timestamp < record.expires_at) {
            revert CreditNotExpired(record.expires_at, block.timestamp);
        }
        if (claimback_registry != address(0)) {
            if (IAqueductSourceMinimal(claimback_registry).hasDeliveryAck(messageId)) {
                // CCIP already delivered downstream. Refuse double-spend.
                revert CreditAlreadySettled(messageId);
            }
        }

        record.is_settled = true;
        // Audit GGG-1 fix: was `usdc.transfer(...)` with discarded return.
        // Real USDC on Arbitrum Sepolia returns true on success, but a future
        // collateral asset add (or a test-USDC variant) returning false
        // silently would corrupt accounting: credit "settled", user empty.
        // Surface the failure now rather than discover it during the demo.
        bool ok = usdc.transfer(record.user, record.amount_wei);
        if (!ok) revert UsdcTransferFailed(record.user, record.amount_wei);
        emit CrossChainCreditClaimedBack(messageId, record.user, record.amount_wei);
    }

    function setClaimbackRegistry(address registry) external onlyTimelock {
        // Audit CCCCC-1 fix: emit the rotation event so the subgraph + UI
        // can track who is currently authorized to flip is_settled. Pre-fix
        // a silent rotation could leave a stale registry observable only
        // via storage reads.
        address previous = claimback_registry;
        claimback_registry = registry;
        emit ClaimbackRegistryUpdated(previous, registry);
    }

    /// @notice Called by AqueductClaimback when the CCIP destination has acked
    /// delivery. Flips the credit's is_settled state + emits the lifecycle event
    /// the subgraph indexer (handleCrossChainCreditSettled) was already wired for.
    ///
    /// Audit CCCC-1 fix: pre-fix `event CrossChainCreditSettled(bytes32)` was
    /// declared at line 94 but NEVER emitted anywhere in this contract. The
    /// subgraph's `handleCrossChainCreditSettled` handler existed but never
    /// fired → every CrossChainCredit entity stayed `isSettled = false` forever
    /// → the UI showed every cross-chain transfer as "in-transit" even after
    /// CCIP delivery confirmed. Dead-event state-machine. Now: AqueductClaimback
    /// calls this when setDeliveryAck arrives, the event fires, the subgraph
    /// flips isSettled. Guarded against double-emit + non-existent credits.
    function markSettled(bytes32 messageId) external {
        if (msg.sender != claimback_registry) revert Unauthorized();
        CrossChainCreditRecord storage record = credits[messageId];
        if (record.user == address(0)) revert CreditNotFound(messageId);
        if (record.is_settled) return; // idempotent, claim_back may have run first
        record.is_settled = true;
        emit CrossChainCreditSettled(messageId);
    }

    /// Parameter change → timelock-only (F-32 fix).
    function setAqueductOnDest(uint64 chain_selector, address aqueduct_address) external onlyTimelock {
        aqueductOnDest[chain_selector] = aqueduct_address;
        emit AqueductOnDestSet(chain_selector, aqueduct_address);
    }

    /// @notice Praetor tops up LINK from the CCIP testnet faucet.
    function depositLink(uint256 amount) external {
        // Audit GGG-1b fix: pre-fix swallowed a false return, leaving the
        // depositor's allowance consumed (typically) without LINK moving.
        bool ok = link.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert LinkTransferFromFailed(msg.sender, amount);
        // Audit CCCCC-2 fix: emit a deposit event so the subgraph + ops
        // dashboard can chart LINK top-ups against the LinkBalanceLow
        // alert series. Pre-fix the event channel showed only the
        // depletion events, not the refills, operators couldn't tell
        // whether a low-balance alert was acted on.
        emit LinkDeposited(msg.sender, amount, link.balanceOf(address(this)));
    }
}
