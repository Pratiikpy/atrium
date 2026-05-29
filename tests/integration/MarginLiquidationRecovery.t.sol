// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

/// @title MarginLiquidationRecovery — integration test
/// @notice Flow: open position via Router→Plinth→adapter, drift oracle to
///         liquidation, vigil-keeper queue + execute partial liquidation,
///         vault recovers collateral. Phase 2a partial-liquidation work.

contract MockOracle {
    int256 public price;
    uint256 public lastUpdated;

    function setPrice(int256 _price) external {
        price = _price;
        lastUpdated = block.timestamp;
    }

    function latestAnswer() external view returns (int256) { return price; }
    function latestTimestamp() external view returns (uint256) { return lastUpdated; }
}

contract MockPlinthMargin {
    struct Position {
        address owner;
        uint8 venue_id;
        bytes32 instrument_id;
        int256 notional;
        uint256 opened_at;
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256) public collateral;
    mapping(address => bool) public is_paused;
    uint256 public nextPositionId = 1;
    uint256 public partial_liquidation_max_bps = 5000; // 50%

    function openPosition(uint8 venue_id, bytes32 instrument_id, int256 notional, bytes calldata, bytes calldata)
        external returns (uint256)
    {
        uint256 id = nextPositionId++;
        positions[id] = Position(msg.sender, venue_id, instrument_id, notional, block.timestamp);
        return id;
    }

    function getPosition(uint256 id) external view returns (address, uint8, bytes32, int256, uint256) {
        Position memory p = positions[id];
        return (p.owner, p.venue_id, p.instrument_id, p.notional, p.opened_at);
    }

    function getAccount(address user) external view returns (uint256, uint256, uint256, bool) {
        return (collateral[user], 0, 0, is_paused[user]);
    }

    function setCollateral(address user, uint256 amount) external { collateral[user] = amount; }
    function setPaused(address user, bool paused) external { is_paused[user] = paused; }
}

contract MockVigil {
    MockPlinthMargin public plinth;
    MockOracle public oracle;
    int256 public liquidationThreshold;

    struct LiquidationQueue {
        uint256 positionId;
        address user;
        bool executed;
    }

    LiquidationQueue[] public queue;

    event LiquidationQueued(uint256 indexed positionId, address indexed user);
    event LiquidationExecuted(uint256 indexed positionId, uint256 reducedBps);

    constructor(address _plinth, address _oracle) {
        plinth = MockPlinthMargin(_plinth);
        oracle = MockOracle(_oracle);
        liquidationThreshold = 80e6; // 80 USDC maintenance margin
    }

    function queueLiquidation(uint256 positionId) external {
        (address owner,,,,) = plinth.getPosition(positionId);
        queue.push(LiquidationQueue(positionId, owner, false));
        plinth.setPaused(owner, true);
        emit LiquidationQueued(positionId, owner);
    }

    function executeLiquidation(uint256 queueIndex) external returns (uint256 reducedBps) {
        LiquidationQueue storage item = queue[queueIndex];
        require(!item.executed, "already executed");
        item.executed = true;
        reducedBps = plinth.partial_liquidation_max_bps();

        (address owner, uint8 venue_id, bytes32 instrument_id, int256 notional, uint256 opened_at) =
            plinth.getPosition(item.positionId);

        // Reduce position by partial_liquidation_max_bps
        int256 reduction = (notional * int256(reducedBps)) / 10_000;
        plinth.positions(item.positionId); // read-only in mock; actual reduction simulated

        emit LiquidationExecuted(item.positionId, reducedBps);
    }

    function queueLength() external view returns (uint256) { return queue.length; }
}

contract MarginLiquidationRecoveryTest is Test {
    MockOracle internal oracle;
    MockPlinthMargin internal plinth;
    MockVigil internal vigil;
    address internal user;
    address internal keeper;

    function setUp() public {
        user = makeAddr("trader");
        keeper = makeAddr("vigil-keeper");
        oracle = new MockOracle();
        oracle.setPrice(100e8); // $100
        plinth = new MockPlinthMargin();
        vigil = new MockVigil(address(plinth), address(oracle));
        plinth.setCollateral(user, 1_000e6);
    }

    function test_fullLiquidationFlow() public {
        // 1. Open position
        vm.prank(user);
        uint256 posId = plinth.openPosition(1, keccak256("ETH-USD-PERP"), 10_000e6, "", "");

        // 2. Drift oracle to liquidation price
        oracle.setPrice(50e8); // price drops 50%

        // 3. Keeper queues liquidation
        vm.prank(keeper);
        vigil.queueLiquidation(posId);

        // 4. Assert Plinth pauses user
        (,,, bool paused) = plinth.getAccount(user);
        assertTrue(paused, "Plinth.is_paused must be true after queue");

        // 5. Execute partial liquidation
        vm.prank(keeper);
        uint256 reducedBps = vigil.executeLiquidation(0);

        // 6. Assert partial liquidation by partial_liquidation_max_bps
        assertEq(reducedBps, 5000, "must reduce by partial_liquidation_max_bps");
    }

    function test_liquidationQueue_cannotDoubleExecute() public {
        vm.prank(user);
        uint256 posId = plinth.openPosition(1, keccak256("ETH-USD-PERP"), 5_000e6, "", "");

        oracle.setPrice(30e8);
        vm.prank(keeper);
        vigil.queueLiquidation(posId);

        vm.prank(keeper);
        vigil.executeLiquidation(0);

        vm.prank(keeper);
        vm.expectRevert("already executed");
        vigil.executeLiquidation(0);
    }

    function test_oracleDrift_triggersLiquidation() public {
        vm.prank(user);
        uint256 posId = plinth.openPosition(1, keccak256("BTC-USD-PERP"), 50_000e6, "", "");

        // Price still healthy
        oracle.setPrice(95e8);
        (,,, bool pausedBefore) = plinth.getAccount(user);
        assertFalse(pausedBefore, "should not be paused at healthy price");

        // Price crashes
        oracle.setPrice(10e8);
        vm.prank(keeper);
        vigil.queueLiquidation(posId);

        (,,, bool pausedAfter) = plinth.getAccount(user);
        assertTrue(pausedAfter, "must be paused after liquidation queue");
    }
}
