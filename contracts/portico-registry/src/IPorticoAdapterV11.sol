// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPorticoAdapter} from "./IPorticoAdapter.sol";

/// @title IPorticoAdapterV11
/// @notice Forward-compatible extension of IPorticoAdapter v1.0 that fixes
///         Agent B audit #10: replaces `tx.origin` ownership with an explicit
///         `originator` parameter passed by Coffer. Adapters opt into v1.1 by
///         additionally implementing `open_position_v11` / `close_position_v11`.
///
/// Backward compatibility: v1.0 IPorticoAdapter functions remain. The
/// PorticoRegistry routes Coffer's adapter_pull-based open through v1.1 when
/// the adapter's `version().major == 1 && version().minor >= 1`.
interface IPorticoAdapterV11 is IPorticoAdapter {
    /// Same as v1.0 open_position but takes an explicit `originator` instead
    /// of relying on `tx.origin`.
    function open_position_v11(
        address originator,
        bytes32 instrument_id,
        int256 notional_signed,
        bytes calldata venue_payload
    ) external returns (uint256 venue_position_id);

    function close_position_v11(
        address originator,
        uint256 venue_position_id,
        bytes calldata venue_payload
    ) external returns (int256 realized_pnl_signed);
}
