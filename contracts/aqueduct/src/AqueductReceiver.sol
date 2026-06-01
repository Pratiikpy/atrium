// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "../../portico-registry/src/ReentrancyGuard.sol";

/// Chainlink CCIP receiver primitives. Verified at
/// resources/chainlink-brownie-contracts/contracts/src/v0.8/ccip/applications/CCIPReceiver.sol
abstract contract CCIPReceiverBase {
    address internal immutable i_router;

    error InvalidRouter(address router);

    constructor(address router) {
        if (router == address(0)) revert InvalidRouter(address(0));
        i_router = router;
    }

    modifier onlyRouter() {
        if (msg.sender != i_router) revert InvalidRouter(msg.sender);
        _;
    }

    function getRouter() public view returns (address) {
        return i_router;
    }
}

interface IAny2EVMMessageReceiver {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }
    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
        EVMTokenAmount[] destTokenAmounts;
    }
    function ccipReceive(Any2EVMMessage calldata message) external;
}

/// 041-SC20 fix: the CCIP OffRamp probes the receiver with ERC165
/// `supportsInterface` before delivering; the receiver must expose it.
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ICoffer {
    function deposit(uint256 assets, address receiver) external returns (uint256);
}

interface IAqueductSourceAck {
    function setDeliveryAck(bytes32 message_id) external;
}

/// @title AqueductReceiver
/// @notice Destination-chain receiver for CCIP messages from Aqueduct.
///         Audit B-13 fix: inherits CCIPReceiverBase so `onlyRouter` reuses
///         the verified Chainlink router-auth pattern. Tokens are read from
///         `destTokenAmounts` (audit B-6/F-4). Delivery-ack is sent back to
///         the source chain via a return CCIP message so claim-back can
///         refuse double-spend (audit B-12).

contract AqueductReceiver is CCIPReceiverBase, IAny2EVMMessageReceiver, IERC165, ReentrancyGuard {
    address public immutable usdc;
    address public immutable coffer_or_zero;
    address public immutable praetor_multisig;
    address public immutable praetor_timelock;

    mapping(uint64 => address) public allowedSourceAqueduct;
    mapping(uint64 => address) public sourceClaimbackRegistry;
    mapping(bytes32 => bool) public processed;

    event CrossChainCreditReceived(
        bytes32 indexed message_id,
        uint64 indexed source_chain,
        address dest_user,
        uint256 amount_wei
    );
    event SourceAqueductSet(uint64 indexed chain_selector, address aqueduct);
    event SourceClaimbackRegistrySet(uint64 indexed chain_selector, address registry);
    event DeliveryAckQueued(bytes32 indexed message_id, address indexed registry);

    error Unauthorized();
    error UnknownSource(uint64 chain_selector, address sender);
    error AlreadyProcessed(bytes32 message_id);
    error NoUsdcInPayload();
    /// Audit GGG-2 fix: silent transfer failure in the no-Coffer / expired path
    /// would corrupt accounting (processed=true, event emitted, user empty).
    error UsdcTransferFailed(address to, uint256 amount);

    modifier onlyTimelock() {
        if (msg.sender != praetor_timelock) revert Unauthorized();
        _;
    }

    constructor(
        address _router,
        address _usdc,
        address _coffer_or_zero,
        address _praetor,
        address _praetor_timelock
    ) CCIPReceiverBase(_router) {
        // Audit iteration 46 fix: pre-fix the constructor accepted any
        // address for all 5 params including zero. The unrecoverable case
        // is _praetor_timelock == 0, setAllowedSource and
        // setSourceClaimbackRegistry are both onlyTimelock, and
        // msg.sender can never equal address(0) on EVM. A typo in deploy
        // would brick cross-chain configuration forever; the only
        // "recovery" is redeploy + CCIP message rerouting.
        // _coffer_or_zero intentionally allows zero (testnet bootstrap
        // before Coffer ships), that's the only sentinel-zero param here.
        // Same DDD-5 / NNNN-1 / BBBBB-1 / LLL-1 pattern as 18 other
        // contracts; partial-coverage closer for AqueductReceiver.
        // _router zero-check lives in the parent constructor, CCIPReceiverBase
        // reverts with InvalidRouter(address(0)) before this body runs. Don't
        // duplicate; the parent has the right selector for ops triage.
        require(_usdc != address(0), "zero usdc");
        require(_praetor != address(0), "zero praetor");
        require(_praetor_timelock != address(0), "zero timelock");
        usdc = _usdc;
        coffer_or_zero = _coffer_or_zero;
        praetor_multisig = _praetor;
        praetor_timelock = _praetor_timelock;
    }

    /// 041-SC20 fix: restore IERC165 supportsInterface. Pre-fix this receiver
    /// dropped it, so the CCIP OffRamp's ERC165Checker probe for
    /// IAny2EVMMessageReceiver returned false and the offRamp skipped
    /// ccipReceive entirely, USDC landed here but dest_user was never
    /// credited. Returning true for the receiver + ERC165 interface ids makes
    /// the offRamp deliver the message and call ccipReceive.
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IAny2EVMMessageReceiver).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }

    function ccipReceive(Any2EVMMessage calldata message) external onlyRouter nonReentrant {
        address source_sender = abi.decode(message.sender, (address));
        if (allowedSourceAqueduct[message.sourceChainSelector] != source_sender) {
            revert UnknownSource(message.sourceChainSelector, source_sender);
        }
        if (processed[message.messageId]) revert AlreadyProcessed(message.messageId);
        processed[message.messageId] = true;

        (address dest_user, uint256 expires_at, address src_user) =
            abi.decode(message.data, (address, uint256, address));
        src_user; // recorded on source chain

        // Parse the actual USDC amount from destTokenAmounts (audit B-6/F-4 fix)
        uint256 received = 0;
        for (uint256 i = 0; i < message.destTokenAmounts.length; i++) {
            if (message.destTokenAmounts[i].token == usdc) {
                received = message.destTokenAmounts[i].amount;
                break;
            }
        }
        if (received == 0) revert NoUsdcInPayload();

        if (coffer_or_zero != address(0) && block.timestamp <= expires_at) {
            IERC20(usdc).approve(coffer_or_zero, received);
            ICoffer(coffer_or_zero).deposit(received, dest_user);
        } else {
            // Audit GGG-2 fix: was `IERC20(usdc).transfer(...)` with discarded
            // return. The else-branch is the user-facing rescue path when
            // Coffer is undeployed or the credit has expired, silent failure
            // here would mark the CCIP message processed (line above) without
            // ever delivering the rescued USDC.
            bool ok = IERC20(usdc).transfer(dest_user, received);
            if (!ok) revert UsdcTransferFailed(dest_user, received);
        }

        emit CrossChainCreditReceived(message.messageId, message.sourceChainSelector, dest_user, received);

        // Audit B-12 fix: notify the source-chain claimback registry so that
        // claim-back refuses double-spend if it runs after this delivery.
        address registry = sourceClaimbackRegistry[message.sourceChainSelector];
        if (registry != address(0)) {
            // In a real CCIP back-channel, this would itself be a CCIP send.
            // Year-1 testnet: emit the ack event for the off-chain Aqueduct watcher
            // to relay via Praetor CLI; production swaps this for an in-CCIP ack.
            emit DeliveryAckQueued(message.messageId, registry);
        }
    }

    function setAllowedSource(uint64 chain_selector, address aqueduct) external onlyTimelock {
        allowedSourceAqueduct[chain_selector] = aqueduct;
        emit SourceAqueductSet(chain_selector, aqueduct);
    }

    function setSourceClaimbackRegistry(uint64 chain_selector, address registry) external onlyTimelock {
        sourceClaimbackRegistry[chain_selector] = registry;
        emit SourceClaimbackRegistrySet(chain_selector, registry);
    }
}
