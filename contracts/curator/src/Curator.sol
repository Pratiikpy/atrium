// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Curator
/// @notice On-chain grant program for community-built Portico adapters.
///         Praetor multisig schedules grant rounds via the timelock; each grant
///         is a (grantee, amount, ipfs_attestation_cid) tuple. The grantee
///         claims by calling `claim` after the timelock readyAt — the timelock
///         window doubles as the public objection period.
///
///         Year-1 budget: $20–50K total per PRD §17. This contract holds USDC
///         (or any IERC20 the timelock configures) and pays out on claim. Per
///         PRD §17 Day-180 target: "Curator grants funded $20–50K" in the
///         REALISTIC scenario, $0 in the FLOOR scenario — so this contract
///         can ship with zero balance and still be honest.
///
///         Audit pattern coverage (Wave-YYYY / BBBBB / CCCCC sweep lenses):
///         - DDD-5 constructor zero-checks for praetor + timelock + asset
///         - F-32 timelock-gated funding (schedule from Praetor, claim by grantee)
///         - CCCCC event-emit completeness on every state-changing setter
///         - GGG-1 transfer-return checked (no silent failures)
///         - F-11 reentrancy guard on the only money-moving function (claim)
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract Curator {
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;
    IERC20 public immutable usdc;

    struct Grant {
        address grantee;
        uint256 amount;
        bytes32 ipfs_attestation_cid;
        uint64 funded_at;
        uint64 claimed_at;
        bool exists;
    }

    /// grant id is a monotonically increasing counter
    mapping(uint256 => Grant) public grants;
    uint256 public next_grant_id;
    uint256 public total_disbursed_wei;
    /// Audit FIRE76-6 fix (sub-agent MEDIUM): track outstanding-but-unclaimed
    /// commitments so `createGrant` rejects schedules that exceed the
    /// contract's funded balance. Pre-fix, the timelock could create 40K +
    /// 40K grants against a 50K balance and the second grantee would be
    /// stuck on `InsufficientBalance`. Decremented on claim + cancel.
    uint256 public total_committed_wei;

    /// Audit FIRE76-8 fix (sub-agent MEDIUM): track total funded so operators
    /// can compute remaining = funded - disbursed - committed in one read
    /// without scraping raw ERC-20 Transfer logs.
    uint256 public total_funded_wei;

    /// CCCCC-pattern: state-changing events on every mutation.
    event GrantCreated(uint256 indexed grant_id, address indexed grantee, uint256 amount, bytes32 ipfs_attestation_cid);
    event GrantClaimed(uint256 indexed grant_id, address indexed grantee, uint256 amount);
    event GrantCancelled(uint256 indexed grant_id, string reason);
    /// Audit FIRE76-8 fix: emit on the canonical funding path.
    event FundsReceived(address indexed from, uint256 amount, uint256 new_total_funded);

    error Unauthorized();
    error GrantNotFound(uint256 grant_id);
    error AlreadyClaimed(uint256 grant_id);
    error UsdcTransferFailed(address to, uint256 amount);
    error InsufficientBalance(uint256 needed, uint256 available);
    error InsufficientFundsForCommitment(uint256 needed_total, uint256 available);
    error ZeroAmount();
    error ZeroGrantee();
    error ZeroIpfs();

    modifier onlyPraetor() {
        if (msg.sender != praetor_multisig) revert Unauthorized();
        _;
    }
    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    // F-11 / ReentrancyGuard inline (one-state-slot guard).
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;
    error ReentrantCall();
    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address _praetor, address _praetor_timelock, address _usdc) {
        // DDD-5 / BBBBB-1 pattern — every dep zero-checked at deploy.
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        require(_usdc != address(0), "zero usdc");
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
        usdc = IERC20(_usdc);
    }

    /// @notice Create a grant record. Timelock-only — the 48h window doubles
    /// as the public objection period before the grantee can claim.
    /// The grant exists in storage from this moment; transfer happens at claim.
    function createGrant(
        address grantee,
        uint256 amount,
        bytes32 ipfs_attestation_cid
    ) external onlyTimelock returns (uint256 grant_id) {
        if (grantee == address(0)) revert ZeroGrantee();
        if (amount == 0) revert ZeroAmount();
        if (ipfs_attestation_cid == bytes32(0)) revert ZeroIpfs();

        // Audit FIRE76-6 fix (sub-agent MEDIUM): reject schedules that would
        // over-commit the funded balance. Pre-fix the timelock could create
        // unfunded grants and the first grantee would drain, leaving the
        // second stuck on InsufficientBalance.
        uint256 bal = usdc.balanceOf(address(this));
        uint256 needed = total_committed_wei + amount;
        if (needed > bal) revert InsufficientFundsForCommitment(needed, bal);
        total_committed_wei = needed;

        grant_id = ++next_grant_id;
        grants[grant_id] = Grant({
            grantee: grantee,
            amount: amount,
            ipfs_attestation_cid: ipfs_attestation_cid,
            funded_at: uint64(block.timestamp),
            claimed_at: 0,
            exists: true
        });
        emit GrantCreated(grant_id, grantee, amount, ipfs_attestation_cid);
    }

    /// @notice Grantee claims their grant. Single call moves USDC out.
    function claim(uint256 grant_id) external nonReentrant {
        Grant storage g = grants[grant_id];
        if (!g.exists) revert GrantNotFound(grant_id);
        if (msg.sender != g.grantee) revert Unauthorized();
        if (g.claimed_at != 0) revert AlreadyClaimed(grant_id);

        uint256 bal = usdc.balanceOf(address(this));
        if (bal < g.amount) revert InsufficientBalance(g.amount, bal);

        g.claimed_at = uint64(block.timestamp);
        total_disbursed_wei += g.amount;
        // Audit FIRE76-6 fix: free up the commitment so future grants can
        // be scheduled against the now-released balance.
        total_committed_wei -= g.amount;

        // GGG-1 pattern: capture transfer return + revert on false. Pre-fix
        // pattern across the codebase: a `let _ = transfer(...)` would let the
        // claim "succeed" while no USDC moved.
        bool ok = usdc.transfer(g.grantee, g.amount);
        if (!ok) revert UsdcTransferFailed(g.grantee, g.amount);

        emit GrantClaimed(grant_id, g.grantee, g.amount);
    }

    /// @notice Cancel a grant before it's claimed. Praetor multisig — emergency
    /// path, no timelock (the timelock window happens once at createGrant).
    /// Audit FIRE76-9 fix (sub-agent MEDIUM): cancel cooldown. The grant's
    /// `funded_at` timestamp is recorded at createGrant. Praetor must wait
    /// CANCEL_COOLDOWN past that timestamp before cancellation. Prevents a
    /// compromised Praetor key from cancel-spamming every timelock-scheduled
    /// grant immediately on creation (defeating the 48h objection window).
    /// 6 hours is long enough to require deliberate human action; short
    /// enough to retain emergency-response capability against truly bad
    /// scheduled grants the timelock window missed.
    uint64 public constant CANCEL_COOLDOWN_SECONDS = 6 hours;
    error CancelCooldownActive(uint64 cancellable_at, uint64 now_seconds);

    function cancelGrant(uint256 grant_id, string calldata reason) external onlyPraetor {
        Grant storage g = grants[grant_id];
        if (!g.exists) revert GrantNotFound(grant_id);
        if (g.claimed_at != 0) revert AlreadyClaimed(grant_id);
        // Audit FIRE76-9 fix: enforce the cooldown.
        uint64 cancellable_at = g.funded_at + CANCEL_COOLDOWN_SECONDS;
        if (uint64(block.timestamp) < cancellable_at) {
            revert CancelCooldownActive(cancellable_at, uint64(block.timestamp));
        }
        // Audit FIRE76-6 fix: release commitment on cancel so the freed
        // balance is available for re-scheduling.
        total_committed_wei -= g.amount;
        delete grants[grant_id];
        emit GrantCancelled(grant_id, reason);
    }

    /// @notice Audit FIRE76-8 fix (sub-agent MEDIUM): canonical funding path.
    /// Anyone can top up the contract; the event records the depositor +
    /// amount + running total. Ops dashboards bind to this event channel
    /// instead of scraping raw USDC.Transfer logs.
    function fund(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert UsdcTransferFailed(address(this), amount);
        total_funded_wei += amount;
        emit FundsReceived(msg.sender, amount, total_funded_wei);
    }

    /// @notice View helper used by the Curator dashboard.
    function getGrant(uint256 grant_id)
        external
        view
        returns (address grantee, uint256 amount, bytes32 cid, uint64 funded_at, uint64 claimed_at, bool exists)
    {
        Grant storage g = grants[grant_id];
        return (g.grantee, g.amount, g.ipfs_attestation_cid, g.funded_at, g.claimed_at, g.exists);
    }
}
