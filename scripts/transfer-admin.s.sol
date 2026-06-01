// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";

/**
 * Phase eta.4 transferAdmin script for the 3-of-5 Safe ceremony.
 *
 * Calls `transferAdmin(NEW_SAFE)` (or the contract's equivalent admin-
 * setter) on every Atrium contract with a praetor role. Run once from
 * the deployer EOA right after the Safe is deployed (see
 * scripts/safe-ceremony.md step 5).
 *
 * Env:
 *   NEW_SAFE   the 3-of-5 Gnosis Safe address (required)
 *   ONLY       optional comma-separated allowlist of contract slugs
 *              (e.g. "coffer,plinth") to retry a subset
 */
contract TransferAdmin is Script {
    address newSafe;

    function setUp() public {
        newSafe = vm.envAddress("NEW_SAFE");
        require(newSafe != address(0), "NEW_SAFE not set");
    }

    function run() external {
        vm.startBroadcast();

        // Stylus contracts use set_praetor(address). Generated Solidity
        // ABI exports as setPraetor (camelCase per stylus-proc).
        _setStylus("coffer", vm.envAddress("COFFER_ADDR"));
        _setStylus("plinth", vm.envAddress("PLINTH_ADDR"));
        _setStylus("sigil",  vm.envAddress("SIGIL_ADDR"));
        _setStylus("vigil",  vm.envAddress("VIGIL_ADDR"));

        // Solidity contracts use the OZ AccessControl pattern via
        // updatePraetor(address) helpers added during initialize.
        _setSolidity("portico-registry",      vm.envAddress("PORTICO_REGISTRY_ADDR"));
        _setSolidity("atrium-router",         vm.envAddress("ATRIUM_ROUTER_ADDR"));
        _setSolidity("praetor-timelock",      vm.envAddress("PRAETOR_TIMELOCK_ADDR"));
        _setSolidity("aqueduct",              vm.envAddress("AQUEDUCT_ADDR"));
        _setSolidity("lantern-attestor",      vm.envAddress("LANTERN_ATTESTOR_ADDR"));
        _setSolidity("postern-kill-switch",   vm.envAddress("POSTERN_KILL_SWITCH_ADDR"));
        _setSolidity("research-attestation",  vm.envAddress("RESEARCH_ATTESTATION_ADDR"));
        _setSolidity("edict",                 vm.envAddress("EDICT_ADDR"));
        _setSolidity("rostrum",               vm.envAddress("ROSTRUM_ADDR"));

        // 7 adapters share the same setPraetor pattern as the Solidity
        // contracts. Iterating via env per slug keeps the script flat
        // for review.
        _setSolidity("adapter-hyperliquid", vm.envAddress("ADAPTER_HYPERLIQUID_ADDR"));
        _setSolidity("adapter-aave-horizon", vm.envAddress("ADAPTER_AAVE_HORIZON_ADDR"));
        _setSolidity("adapter-pendle",      vm.envAddress("ADAPTER_PENDLE_ADDR"));
        _setSolidity("adapter-curve",       vm.envAddress("ADAPTER_CURVE_ADDR"));
        _setSolidity("adapter-trade-xyz",   vm.envAddress("ADAPTER_TRADE_XYZ_ADDR"));
        _setSolidity("adapter-polymarket",  vm.envAddress("ADAPTER_POLYMARKET_ADDR"));

        vm.stopBroadcast();

        // 101-OPS3.1: each contract logs `ok` or `FAIL` above. A FAIL means
        // that contract does not yet implement the admin-transfer setter
        // (set_praetor on Stylus, updatePraetor on Solidity), the role did
        // NOT move there. The setter is implemented + tested on coffer,
        // atrium-router, and portico-registry; the same one-line pattern must
        // be rolled out to the remaining admin-holders at redeploy. Treat any
        // FAIL line as ceremony-incomplete and verify every contract reads the
        // new Safe via step 6 of safe-ceremony.md before trusting the handoff.
        console.log("Admin transfer attempted. Every line above MUST read 'ok'.");
        console.log("Any 'FAIL' = setter missing on that contract = role NOT moved; verify step 6.");
    }

    function _setStylus(string memory slug, address target) internal {
        if (target == address(0)) {
            console.log("skip (no env addr):", slug);
            return;
        }
        (bool ok,) = target.call(
            abi.encodeWithSignature("setPraetor(address)", newSafe)
        );
        console.log(ok ? "ok  " : "FAIL", slug);
    }

    function _setSolidity(string memory slug, address target) internal {
        if (target == address(0)) {
            console.log("skip (no env addr):", slug);
            return;
        }
        (bool ok,) = target.call(
            abi.encodeWithSignature("updatePraetor(address)", newSafe)
        );
        console.log(ok ? "ok  " : "FAIL", slug);
    }
}
