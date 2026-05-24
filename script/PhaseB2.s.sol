// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AtriumRouter} from "../contracts/atrium-router/src/AtriumRouter.sol";
import {Rostrum} from "../contracts/rostrum/src/Rostrum.sol";

/// @title Atrium Phase-B.2 deploy — contracts that depend on Plinth
/// @notice Plinth is now live (Stylus, deployed via cargo-stylus 0.10.7
///         multi-fragment factory at 0x485218e340d1e3b272bed337ec59ffe0a3dc4781).
///         This script deploys AtriumRouter and Rostrum which both need
///         Plinth's address in their constructor.
contract PhaseB2 is Script {
    // === Phase-A outputs (deployments/arbitrum_sepolia.json) ===
    address constant PLINTH_STYLUS    = 0x485218E340D1E3b272Bed337Ec59FfE0a3dC4781;
    address constant COFFER_STYLUS    = 0x7420084855421EF0794a971BD5190F5c0C292071;
    address constant PORTICO_REGISTRY = 0x9A9aF6e50491Cd4694699d48564bBFF18f9B40BC;
    address constant PRAETOR_TIMELOCK = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(block.chainid == 421614, "expected Arbitrum Sepolia (421614)");

        vm.startBroadcast(pk);

        AtriumRouter router = new AtriumRouter(
            PLINTH_STYLUS,
            COFFER_STYLUS,
            PORTICO_REGISTRY,
            deployer            // praetor (testnet = deployer EOA)
        );
        console.log("AtriumRouter:    ", address(router));

        Rostrum rostrum = new Rostrum(
            PLINTH_STYLUS,
            deployer,           // praetor
            PRAETOR_TIMELOCK
        );
        console.log("Rostrum:         ", address(rostrum));

        vm.stopBroadcast();
    }
}
