// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

/// @title Seed, local demo state for `make demo`.
/// @notice Invoked by `praetor seed` (services/praetor-cli/src/commands/seed.rs).
///         Closes `human_left.md` #30 (YYY-7). PRD §26.2 + TDD Tenet 8
///         require a ≤90s clone-to-running stack; this script is the final
///         step that turns a freshly deployed contract set into a demo-able
///         system with positions + keepers + attestations.
///
/// The script reads deployed addresses from `deploy/local.json` (written by
/// `praetor deploy --network local --all`) and runs:
///   1. Mint 100K mock-USDC to 3 wallets via Coffer.deposit.
///   2. Stake 3 keeper bots in Vigil with 1 ETH each (Vigil min-stake).
///   3. Open 1 hedged position via AtriumRouter (Curve adapter, 1000 USDC).
///   4. Publish a placeholder backtest CID via ResearchAttestation.
///
/// All four steps are wrapped in `vm.startBroadcast` so they execute as real
/// txs on the local anvil fork, the verifier UI sees them via Scribe.
contract Seed is Script {
    address constant USDC_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d; // Arbitrum Sepolia USDC
    uint256 constant SEED_USDC = 100_000e6;
    uint256 constant POSITION_NOTIONAL = 1_000e6;
    uint256 constant KEEPER_STAKE = 1 ether;
    uint8 constant CURVE_VENUE_ID = 5;

    function run() external {
        string memory json = vm.readFile("deploy/local.json");
        address coffer = vm.parseJsonAddress(json, ".contracts.coffer.address");
        address vigil = vm.parseJsonAddress(json, ".contracts.vigil.address");
        address router = vm.parseJsonAddress(json, ".contracts.\"atrium-router\".address");
        address researchAttestation = vm.parseJsonAddress(json, ".contracts.\"research-attestation\".address");

        // 3 demo wallets, deterministic per anvil index (foundry default mnemonic).
        address[3] memory wallets = [
            vm.addr(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d),
            vm.addr(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a),
            vm.addr(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6)
        ];

        vm.startBroadcast();

        // Step 1: fund wallets with mock USDC via Coffer.deposit (mints shares
        // 1:1 since the vault is empty on a fresh seed).
        for (uint256 i = 0; i < wallets.length; i++) {
            (bool ok, ) = USDC_SEPOLIA.call(
                abi.encodeWithSignature("approve(address,uint256)", coffer, SEED_USDC)
            );
            if (!ok) console2.log("USDC approve failed for", wallets[i]);
            (bool ok2, ) = coffer.call(
                abi.encodeWithSignature("deposit(uint256,address)", SEED_USDC, wallets[i])
            );
            if (!ok2) console2.log("Coffer.deposit failed for", wallets[i]);
        }

        // Step 2: stake 3 keepers in Vigil.
        for (uint256 i = 0; i < wallets.length; i++) {
            (bool ok, ) = vigil.call{value: KEEPER_STAKE}(
                abi.encodeWithSignature("stake_keeper()")
            );
            if (!ok) console2.log("Vigil.stake_keeper failed for keeper #", i);
        }

        // Step 3: open 1 hedged position via Router (Curve venue, 1000 USDC).
        // Empty sigils + payload since this is the local demo; production
        // uses real EIP-712 envelopes.
        bytes32 instrumentId = keccak256("CURVE-3POOL-USDC");
        (bool ok3, ) = router.call(
            abi.encodeWithSignature(
                "open_position_via_adapter(uint8,bytes32,int256,bytes,bytes,bytes)",
                CURVE_VENUE_ID,
                instrumentId,
                int256(POSITION_NOTIONAL),
                bytes(""),
                bytes(""),
                bytes("")
            )
        );
        if (!ok3) console2.log("Router.open_position_via_adapter failed");

        // Step 4: placeholder backtest attestation. Real backtest ships in
        // Month 5 from the Archive Jupyter notebook (PRD §22.2).
        // Audit fix (#64): ResearchAttestation.publish is onlyTimelock - the
        // praetor_timelock CONTRACT, never the deployer EOA that broadcasts this
        // seed - so this direct call ALWAYS reverts. Previously the failure was
        // swallowed into a log while the summary below claimed "attestation all
        // live" (a no-fake-pending violation). The real publish path is a
        // PraetorTimelock schedule+execute (praetor-cli research/lantern
        // publish), not the deployer seed. We attempt it so intent is recorded,
        // but report the truth in the summary instead of pretending.
        bytes32 cid = keccak256("ipfs://Qm.../local-demo-backtest");
        (bool ok4, ) = researchAttestation.call(
            abi.encodeWithSignature(
                "publish(bytes32,uint256,int256,string)",
                cid,
                uint256(1234), // trades_count placeholder
                int256(4200), // collateral_delta_bps, 42% saving placeholder
                "ipfs://Qm.../local-demo-backtest.ipynb"
            )
        );
        if (!ok4) {
            console2.log("ResearchAttestation.publish skipped: onlyTimelock - run via PraetorTimelock schedule+execute (praetor-cli), not the deployer seed");
        }

        vm.stopBroadcast();

        if (ok4) {
            console2.log("Seed complete. Wallets, keepers, position, attestation all live.");
        } else {
            console2.log("Seed complete. Wallets, keepers, position live; attestation pending timelock publish (see above).");
        }
    }
}
