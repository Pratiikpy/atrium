// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockAavePool
/// @notice Testnet stub for Aave V3's Pool. There is no real Aave V3
///         deployment on Arbitrum Sepolia, so the AaveHorizonAdapterV11
///         points at this contract during Year-1. Round-trips USDC 1:1
///         with a monotonically-drifting liquidity index so the adapter's
///         getReserveData call returns a non-zero index (the adapter
///         treats index == 0 as "venue offline").
///
/// @dev This is NOT a security model; it's a testnet harness. The mock
///      holds whatever USDC is supplied and gives it back on withdraw.
///      No interest accrues to suppliers - the drifting index is purely
///      cosmetic so the adapter's view fns return believable values.
///      Real Aave V3 lending lands at the mainnet flip (Year-2).
///
/// Per `.claude/rules/security.md`: testnet posture only; never deploy
/// to a network where real funds depend on the mock's behavior.
contract MockAavePool {
    /// Internal accounting: how much each `onBehalfOf` has supplied per asset.
    /// Sum across all `onBehalfOf` == this contract's actual balance.
    mapping(address => mapping(address => uint256)) public supplied;

    /// Liquidity index drifts up 5 bps on every reserve-data read. Seeded
    /// at 1e27 (Aave V3 ray) so the first read returns a non-zero value.
    /// Monotonic across the lifetime of the mock.
    uint128 public liquidityIndex = 1e27;

    event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode);
    event Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount);

    error AmountZero();
    error InsufficientSupplied(address asset, address onBehalfOf, uint256 requested, uint256 available);
    error TransferFailed();

    /// @notice Aave V3 Pool.supply signature (asset, amount, onBehalfOf, referralCode).
    ///         Caller must have approved this contract for `amount` USDC first.
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        if (amount == 0) revert AmountZero();
        bool ok = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        supplied[asset][onBehalfOf] += amount;
        emit Supply(asset, msg.sender, onBehalfOf, amount, referralCode);
    }

    /// @notice Aave V3 Pool.withdraw signature (asset, amount, to).
    ///         Decrements the caller's `supplied` accounting and sends USDC.
    ///         Returns the actual amount withdrawn (always `amount` here;
    ///         real Aave clamps to balance when `amount == type(uint256).max`).
    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        if (amount == 0) revert AmountZero();
        uint256 available = supplied[asset][msg.sender];
        if (available < amount) {
            revert InsufficientSupplied(asset, msg.sender, amount, available);
        }
        supplied[asset][msg.sender] = available - amount;
        bool ok = IERC20(asset).transfer(to, amount);
        if (!ok) revert TransferFailed();
        emit Withdraw(asset, msg.sender, to, amount);
        return amount;
    }

    /// @notice Aave V3 Pool.getReserveData. Returns the 15-tuple the
    ///         adapter expects, with liquidityIndex monotonically drifting
    ///         5 bps per call so health views render movement.
    /// @dev    Only the second slot (liquidityIndex) is load-bearing -
    ///         the adapter at line 170 reads exactly that field. Other
    ///         slots are zero; the adapter doesn't read them.
    function getReserveData(address /* asset */) external returns (
        uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16,
        address, address, address, address, uint128, uint128, uint128
    ) {
        // 5 bps = 5/10000 of the current index. uint128 so safe-mul.
        liquidityIndex = uint128(uint256(liquidityIndex) + uint256(liquidityIndex) * 5 / 10000);
        return (
            0,                    // configuration
            liquidityIndex,       // liquidityIndex (slot the adapter reads)
            0, 0, 0, 0, 0, 0,     // rate fields + last-update fields
            address(0),           // aTokenAddress (zero - mock doesn't issue aTokens)
            address(0),           // stableDebtTokenAddress
            address(0),           // variableDebtTokenAddress
            address(0),           // interestRateStrategyAddress
            0, 0, 0               // accruedToTreasury, unbacked, isolationModeTotalDebt
        );
    }

    /// @notice Pure-view variant for off-chain readers that can't tolerate
    ///         the state-mutating drift in getReserveData. Returns the
    ///         current index without advancing it.
    function getReserveDataView(address /* asset */) external view returns (uint128) {
        return liquidityIndex;
    }
}
