// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MockUSDC
/// @notice Minimal 6-decimal ERC-20 USDC stand-in for testnets that do not
///         have a canonical USDC (e.g. Robinhood Chain testnet). Anyone can
///         mint so a demo wallet can self-fund; this is a testnet harness, not
///         a production token. Mirrors the contracts/mocks/ testnet-stub
///         convention (MockAavePool, MockChainlinkUsdFeed).
contract MockUSDC {
    string public constant name = "Mock USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();

    /// @notice Open mint for testnet self-funding (5 USDC default if amount 0).
    function mint(address to, uint256 amount) external {
        uint256 amt = amount == 0 ? 5_000_000 : amount;
        balanceOf[to] += amt;
        totalSupply += amt;
        emit Transfer(address(0), to, amt);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a < value) revert InsufficientAllowance();
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        uint256 b = balanceOf[from];
        if (b < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = b - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
