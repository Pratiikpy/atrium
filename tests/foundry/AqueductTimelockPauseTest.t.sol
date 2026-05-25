// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Aqueduct} from "../../contracts/aqueduct/src/Aqueduct.sol";
import {PraetorTimelock, IPausable} from "../../contracts/praetor-timelock/src/PraetorTimelock.sol";

/// @title Aqueduct ⇄ PraetorTimelock pause-selector regression
/// @notice Phase theta.1 fix verification. Pre-fix Aqueduct declared
///         `pause(string)` while PraetorTimelock's `IPausable` interface
///         declared `pause(bytes32)`. The two ABIs share a name but compile
///         to different selectors (0x6da66355 vs 0xed56531a), so every
///         multisig emergency-pause routed through the timelock helper
///         silently reverted at Aqueduct. The bug was invisible to the
///         existing Aqueduct.t.sol pause tests because those call
///         `aqueduct.pause(...)` directly from a vm.prank'd multisig and
///         never traverse the timelock.
///
///         This suite pins the end-to-end path: timelock helper →
///         IPausable.pause(bytes32) → Aqueduct.is_paused = true.
contract AqueductTimelockPauseTest is Test {
    Aqueduct internal aqueduct;
    PraetorTimelock internal timelock;
    MockRouter internal router;
    MockERC20 internal usdc;
    MockERC20 internal link;
    MockCoffer internal coffer;

    address internal multisig;

    event EmergencyPaused(address indexed by, bytes32 reason);

    function setUp() public {
        multisig = makeAddr("praetor-multisig");

        timelock = new PraetorTimelock(multisig);

        router = new MockRouter();
        usdc = new MockERC20("USDC", 6);
        link = new MockERC20("LINK", 18);
        coffer = new MockCoffer(address(usdc));

        // Aqueduct.praetor_multisig + Aqueduct.praetor_timelock are immutable
        // and unaffected by ownership transfers; wire them to the live timelock
        // contract so the selector test exercises the same code path the live
        // testnet deploy uses.
        aqueduct = new Aqueduct(
            address(router),
            address(usdc),
            address(link),
            address(coffer),
            multisig,
            address(timelock)
        );
    }

    /// The load-bearing test. Pre-fix this reverted with the timelock's
    /// `CallFailed("")` because the selector mismatch produced empty
    /// returndata on the call-into-Aqueduct.
    function test_emergencyPause_throughTimelock_pausesAqueduct() public {
        vm.expectEmit(true, false, false, true, address(aqueduct));
        emit EmergencyPaused(address(timelock), keccak256(bytes("scribe-stalled")));

        vm.prank(multisig);
        timelock.emergencyPause(address(aqueduct), "scribe-stalled");

        assertTrue(aqueduct.is_paused(), "Aqueduct must flip is_paused via timelock helper");
    }

    /// Selector-shape pin. If a future refactor reverts to pause(string),
    /// this guard fires before the timelock test does, narrowing the
    /// diagnostic surface area for the next person hitting it.
    function test_aqueduct_exposes_pauseBytes32_selector() public view {
        bytes4 expected = bytes4(keccak256("pause(bytes32)"));
        bytes4 actual = IPausable.pause.selector;
        assertEq(actual, expected, "IPausable.pause selector drifted from bytes32");
    }

    /// EOA-target guard from LLL-5 still fires; sanity that Phase theta.1
    /// did not accidentally lose that defense-in-depth check.
    function test_emergencyPause_rejectsEoaTarget() public {
        address eoa = makeAddr("not-a-contract");
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(PraetorTimelock.TargetNotAContract.selector, eoa));
        timelock.emergencyPause(eoa, "drill");
    }
}

// ── Minimal Aqueduct dependencies (mirror Aqueduct.t.sol) ────────────────

contract MockRouter {
    bool internal supported = true;
    function setChainSupported(uint64, bool ok) external { supported = ok; }
    function isChainSupported(uint64) external view returns (bool) { return supported; }
    function getFee(uint64, bytes calldata) external pure returns (uint256) { return 1e16; }
    function ccipSend(uint64, bytes calldata) external payable returns (bytes32) {
        return keccak256("mock-msg");
    }
}

contract MockCoffer {
    address public immutable usdc;
    constructor(address _usdc) { usdc = _usdc; }
    function adapterPull(uint256, address, address) external pure {}
}

contract MockERC20 {
    string public name;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(string memory _name, uint8 _decimals) { name = _name; decimals = _decimals; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        return true;
    }
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        require(allowance[from][msg.sender] >= v, "allowance");
        require(balanceOf[from] >= v, "balance");
        allowance[from][msg.sender] -= v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
        return true;
    }
}
