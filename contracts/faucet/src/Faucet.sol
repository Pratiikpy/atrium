// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Faucet, onboarding drop for testnet users
/// @notice Each address can claim once per `cooldown` seconds. Drops a fixed
///         amount of USDC (the Atrium collateral asset on Sepolia) plus a
///         small ETH grant so the wallet has gas for follow-up transactions.
///
/// @dev Stocked manually by Praetor:
///   1. Praetor transfers USDC to this contract.
///   2. Praetor sends ETH to this contract (receive() accepts it).
///   3. Users call `claim()` from the verify-app onboarding flow.
///
/// Audit notes:
///  - Per-address cooldown blocks farming; an attacker would need new
///    wallets, which still costs ETH from somewhere upstream.
///  - drainUsdc/drainEth let Praetor recover funds if testnet is sunsetted.
///  - Reentrancy guard: not needed because USDC.transfer + .call{value:}
///    follow checks-effects-interactions and the recipient address is
///    user-controlled but we update lastClaim BEFORE the calls.
contract Faucet {
    address public immutable usdc;
    address public immutable praetor;
    uint256 public immutable usdcDrop;
    uint256 public immutable ethDrop;
    uint64 public immutable cooldown;

    mapping(address => uint64) public lastClaim;

    error Cooldown(uint64 secondsRemaining);
    error TransferFailed();
    error Unauthorized();
    error EthDropFailed();
    // Audit 2026-05-25 LOW-1: drain* recipient must not be zero. Cheap
    // guard against a praetor fat-finger that would burn the funds.
    error ZeroRecipient();

    event Claimed(address indexed user, uint256 usdcAmount, uint256 ethAmount);
    event Stocked(address indexed who, uint256 usdcAmount, uint256 ethAmount);

    constructor(
        address _usdc,
        address _praetor,
        uint256 _usdcDrop,
        uint256 _ethDrop,
        uint64 _cooldown
    ) {
        require(_usdc != address(0), "zero usdc");
        require(_praetor != address(0), "zero praetor");
        usdc = _usdc;
        praetor = _praetor;
        usdcDrop = _usdcDrop;
        ethDrop = _ethDrop;
        cooldown = _cooldown;
    }

    receive() external payable {
        emit Stocked(msg.sender, 0, msg.value);
    }

    function claim() external {
        uint64 last = lastClaim[msg.sender];
        if (last != 0) {
            uint64 nextAllowed = last + cooldown;
            if (block.timestamp < nextAllowed) {
                revert Cooldown(nextAllowed - uint64(block.timestamp));
            }
        }
        lastClaim[msg.sender] = uint64(block.timestamp);

        bool ok = IERC20(usdc).transfer(msg.sender, usdcDrop);
        if (!ok) revert TransferFailed();

        if (ethDrop > 0 && address(this).balance >= ethDrop) {
            (bool sent,) = msg.sender.call{value: ethDrop}("");
            if (!sent) revert EthDropFailed();
            emit Claimed(msg.sender, usdcDrop, ethDrop);
        } else {
            emit Claimed(msg.sender, usdcDrop, 0);
        }
    }

    /// Praetor-only escape hatch for unused testnet funds.
    function drainUsdc(address to, uint256 amount) external {
        if (msg.sender != praetor) revert Unauthorized();
        if (to == address(0)) revert ZeroRecipient();
        bool ok = IERC20(usdc).transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    function drainEth(address payable to, uint256 amount) external {
        if (msg.sender != praetor) revert Unauthorized();
        if (to == address(0)) revert ZeroRecipient();
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert EthDropFailed();
    }
}
