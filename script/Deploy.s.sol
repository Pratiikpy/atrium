// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PraetorTimelock} from "../contracts/praetor-timelock/src/PraetorTimelock.sol";
import {PorticoRegistry} from "../contracts/portico-registry/src/PorticoRegistry.sol";
import {LanternAttestor} from "../contracts/lantern-attestor/src/LanternAttestor.sol";
import {Curator} from "../contracts/curator/src/Curator.sol";
import {Edict} from "../contracts/edict/src/Edict.sol";
import {ResearchAttestation} from "../contracts/research-attestation/src/ResearchAttestation.sol";
import {StoaBlackScholes} from "../contracts/stoa/src/StoaBlackScholes.sol";

/// @title Atrium Phase-1 deploy — standalone Solidity contracts
/// @notice Deploys the 7 Solidity contracts that have no Stylus dependencies.
///         Stylus contracts (Coffer, Plinth, Sigil, Vigil) deploy in a separate
///         phase once the stylus-sdk/Rust-1.92 const-eval bug is resolved.
///
///         Stylus-dependent Solidity contracts (PosternKillSwitch, PosternKeyRegistry,
///         Rostrum, Aqueduct, AtriumRouter) defer until Stylus addresses are known.
///
///         For testnet, multisig + signing-key + sumsub-verifier all point at the
///         deployer EOA. Praetor timelock can rotate them later via scheduled
///         calls. NEVER deploy to mainnet with this script unchanged.
contract Deploy is Script {
    /// Arbitrum Sepolia USDC (Circle official)
    address constant ARB_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        console.log("Deployer:        ", deployer);
        console.log("Starting nonce:  ", vm.getNonce(deployer));
        console.log("Chain id:        ", block.chainid);

        vm.startBroadcast(pk);

        // 1. PraetorTimelock — multisig is deployer for testnet, rotated to a
        //    real Safe before mainnet.
        PraetorTimelock timelock = new PraetorTimelock(deployer);
        console.log("PraetorTimelock: ", address(timelock));

        // 2. PorticoRegistry — adapter whitelist, owned by Praetor + timelock.
        PorticoRegistry registry = new PorticoRegistry(deployer, address(timelock));
        console.log("PorticoRegistry: ", address(registry));

        // 3. LanternAttestor — signing key = deployer for testnet; timelock can rotate.
        LanternAttestor attestor = new LanternAttestor(deployer, deployer, address(timelock));
        console.log("LanternAttestor: ", address(attestor));

        // 4. Curator — grants program (needs USDC asset address).
        Curator curator = new Curator(deployer, address(timelock), ARB_SEPOLIA_USDC);
        console.log("Curator:         ", address(curator));

        // 5. Edict — cohort tier registry. Sumsub stub = deployer; timelock rotates.
        Edict edict = new Edict(deployer, address(timelock), deployer);
        console.log("Edict:           ", address(edict));

        // 6. ResearchAttestation — backtest publisher, gated on timelock.
        ResearchAttestation research = new ResearchAttestation(address(timelock));
        console.log("ResearchAttestation:", address(research));

        // 7. StoaBlackScholes — pure-math scaffold, no constructor args.
        StoaBlackScholes stoa = new StoaBlackScholes();
        console.log("StoaBlackScholes:", address(stoa));

        vm.stopBroadcast();

        console.log("Final nonce:     ", vm.getNonce(deployer));
        console.log("DONE. Run scripts/save-deployments.mjs to write the registry.");
    }
}
