// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ReentrancyGuard
/// @notice Single-storage-slot reentrancy guard for Portico adapters.
///         Pattern mirrors OpenZeppelin ReentrancyGuard. Audit F-11 fix:
///         every adapter open_position / close_position is wrapped with the
///         `nonReentrant` modifier so external venue calls cannot re-enter
///         the adapter mid-execution.
abstract contract ReentrancyGuard {
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
}
