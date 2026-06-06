// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MockChainlinkUsdFeed
/// @notice Testnet stub for a Chainlink AggregatorV3 USD price feed. Arbitrum
///         Sepolia has NO canonical Chainlink USDC/USD aggregator (confirmed:
///         the mainnet aggregator addresses have no code on 421614), so the
///         Plinth dual-oracle reader (PlinthOracle.safe_price) points a
///         per-instrument `chainlink_feed` at this contract for Year-1 testnet.
///
///         The Pyth leg stays the real on-chain Pyth oracle (a per-trade Hermes
///         push keeps it inside the 60s freshness window); this mock supplies
///         only the Chainlink leg that the chain otherwise lacks.
///
/// @dev    `latestRoundData` returns updatedAt == block.timestamp and
///         answeredInRound == roundId, so it ALWAYS satisfies PlinthOracle's
///         freshness window and stale-round gate. The price is admin-settable
///         so a demo can move the mark or test the 50bps disagreement revert.
///         This is NOT a security model; it is a testnet harness, exactly like
///         contracts/mocks/MockAavePool.sol. Real Chainlink Data Feeds land
///         at the Year-2 mainnet flip. Per docs/conventions/security.md:
///         testnet posture only; never deploy where real funds depend on it.
contract MockChainlinkUsdFeed {
    int256 public answer;
    uint8 public immutable decimals;
    uint80 public roundId;
    address public immutable admin;
    string public description;

    error NotAdmin();

    event AnswerUpdated(int256 indexed current, uint80 indexed roundId, uint256 updatedAt);

    constructor(int256 _initialAnswer, uint8 _decimals, string memory _description) {
        require(_initialAnswer > 0, "answer must be positive");
        answer = _initialAnswer;
        decimals = _decimals;
        roundId = 1;
        admin = msg.sender;
        description = _description;
        emit AnswerUpdated(_initialAnswer, 1, block.timestamp);
    }

    /// @notice Admin-only price update (advances the round). Lets a demo move
    ///         the mark or push the two oracles past the 50bps tolerance to
    ///         exercise PlinthOracle's ERR_ORACLE_DISAGREEMENT path on-chain.
    function setAnswer(int256 _answer) external {
        if (msg.sender != admin) revert NotAdmin();
        require(_answer > 0, "answer must be positive");
        answer = _answer;
        roundId += 1;
        emit AnswerUpdated(_answer, roundId, block.timestamp);
    }

    /// @notice AggregatorV3Interface.latestRoundData. updatedAt and
    ///         answeredInRound are synthesized to now / current round so the
    ///         reader always sees a fresh, complete round.
    function latestRoundData()
        external
        view
        returns (uint80 roundId_, int256 answer_, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (roundId, answer, block.timestamp, block.timestamp, roundId);
    }

    /// @notice Latest answer (legacy AggregatorV2 accessor, kept for parity).
    function latestAnswer() external view returns (int256) {
        return answer;
    }
}
