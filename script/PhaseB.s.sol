// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Aqueduct} from "../contracts/aqueduct/src/Aqueduct.sol";
import {AqueductReceiver} from "../contracts/aqueduct/src/AqueductReceiver.sol";
import {AqueductClaimback} from "../contracts/aqueduct/src/AqueductClaimback.sol";
import {PosternKillSwitch} from "../contracts/postern-kill-switch/src/PosternKillSwitch.sol";
import {PosternKeyRegistry} from "../contracts/postern-kill-switch/src/PosternKeyRegistry.sol";
import {Faucet} from "../contracts/faucet/src/Faucet.sol";

/// @title Atrium Phase-B deploy, Solidity contracts that depend on the
///        already-deployed Stylus contracts (Coffer, Sigil, Vigil, PlinthMath).
/// @notice Atrium Phase-A deployed 4 Stylus contracts + 7 standalone Solidity
///         contracts. This script picks up the Solidity contracts that needed
///         to wait for the Stylus addresses to exist.
///
///         Skips: AtriumRouter, Rostrum, venue adapters, all blocked on
///         Plinth deploying (size surgery pending, see LAUNCH_READY.md §A.7).
contract PhaseB is Script {
    // === Live testnet addresses (per Chainlink + Circle docs) ===
    address constant ARB_SEPOLIA_CCIP_ROUTER = 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165;
    address constant ARB_SEPOLIA_LINK        = 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E;
    address constant ARB_SEPOLIA_USDC        = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    // ERC-4337 EntryPoint v0.7 (canonical address, same on every chain)
    address constant ENTRYPOINT_V07          = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // === Phase-A deploy outputs (see deployments/arbitrum_sepolia.json) ===
    // Checksums calculated by EIP-55, Solidity refuses any other casing.
    address constant PRAETOR_TIMELOCK        = 0x0dAd24d7feb2bB797e0f69e02c2F32104FCF22d4;
    address constant COFFER_STYLUS           = 0x7420084855421EF0794a971BD5190F5c0C292071;
    address constant SIGIL_STYLUS            = 0xEfD38821466Ca31E0B1734F89F1D6EC9A4bc70D0;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        console.log("Deployer:        ", deployer);
        console.log("Chain id:        ", block.chainid);
        require(block.chainid == 421614, "expected Arbitrum Sepolia (421614)");

        vm.startBroadcast(pk);

        // -----------------------------------------------------------------
        // 1. Aqueduct (CCIP bridge), depends on Coffer
        // -----------------------------------------------------------------
        Aqueduct aqueduct = new Aqueduct(
            ARB_SEPOLIA_CCIP_ROUTER,
            ARB_SEPOLIA_USDC,
            ARB_SEPOLIA_LINK,
            COFFER_STYLUS,
            deployer,           // praetor (testnet = deployer EOA)
            PRAETOR_TIMELOCK
        );
        console.log("Aqueduct:         ", address(aqueduct));

        // 2. AqueductReceiver, also needs USDC + Coffer + Praetor wiring
        // so it can credit cross-chain arrivals into the Coffer vault.
        AqueductReceiver receiver = new AqueductReceiver(
            ARB_SEPOLIA_CCIP_ROUTER,
            ARB_SEPOLIA_USDC,
            COFFER_STYLUS,
            deployer,           // praetor (testnet = deployer EOA)
            PRAETOR_TIMELOCK
        );
        console.log("AqueductReceiver: ", address(receiver));

        // 3. AqueductClaimback, depends on Aqueduct
        AqueductClaimback claimback = new AqueductClaimback(
            address(aqueduct),
            ARB_SEPOLIA_CCIP_ROUTER
        );
        console.log("AqueductClaimback:", address(claimback));

        // -----------------------------------------------------------------
        // 4 + 5. Postern Kill Switch + Key Registry (circular dep)
        //
        // KillSwitch.constructor(sigil, entryPoint, keyRegistry)
        // KeyRegistry.constructor(killSwitch)
        //
        // Pre-compute KillSwitch's CREATE address. The deployer's next
        // nonce N is the KeyRegistry's address; nonce N+1 is the
        // KillSwitch's address. KeyRegistry's constructor stores the
        // predicted KillSwitch address; KillSwitch stores the actual
        // KeyRegistry address. They match because we got the nonce right.
        // -----------------------------------------------------------------
        uint256 nextNonce = vm.getNonce(deployer);
        address predictedKeyRegistry = vm.computeCreateAddress(deployer, nextNonce);
        address predictedKillSwitch  = vm.computeCreateAddress(deployer, nextNonce + 1);

        PosternKeyRegistry keyRegistry = new PosternKeyRegistry(predictedKillSwitch);
        console.log("PosternKeyRegistry:", address(keyRegistry));
        require(address(keyRegistry) == predictedKeyRegistry, "nonce mismatch");

        PosternKillSwitch killSwitch = new PosternKillSwitch(
            SIGIL_STYLUS,
            ENTRYPOINT_V07,
            address(keyRegistry)
        );
        console.log("PosternKillSwitch:", address(killSwitch));
        require(address(killSwitch) == predictedKillSwitch, "nonce mismatch");

        vm.stopBroadcast();
    }
}

/// @notice Standalone script to deploy just the Faucet (run after Phase B).
///         Onboarding drop sized to the testnet USDC the Circle faucet
///         actually grants per claim (~10 USDC per 24 h). Original spec
///         called for 100 USDC drops but that requires a whale-deposit
///         we don't have, 5 USDC × 8 claims is the realistic ratio.
contract DeployFaucet is Script {
    address constant ARB_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(block.chainid == 421614, "expected Arbitrum Sepolia (421614)");

        vm.startBroadcast(pk);

        // Testnet USDC has 6 decimals. Sized to fit realistic Circle-faucet
        // refill cadence: with 40 USDC stocked, 5 USDC × 8 claims is useful;
        // 100 USDC × 0 claims is broken-on-arrival.
        // ETH drop sized to one Coffer.deposit + one Plinth.open_position.
        Faucet f = new Faucet(
            ARB_SEPOLIA_USDC,
            deployer,
            5_000_000,          // 5 USDC per claim
            0.0005 ether,       // 0.0005 ETH for gas (~25 cents)
            uint64(24 hours)
        );
        console.log("Faucet:           ", address(f));

        vm.stopBroadcast();
    }
}
