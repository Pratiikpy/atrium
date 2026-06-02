#!/bin/sh
set -e
cd /work
# Post-cutover addresses (deployments/arbitrum_sepolia.json). The pre-cutover
# router 0xf134127c / rostrum 0xbaf348e6 were retired; verify the live ones.
forge verify-contract 0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0 contracts/atrium-router/src/AtriumRouter.sol:AtriumRouter --chain-id 421614 --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
echo
forge verify-contract 0x748A0a4E53F3E94f9a279bfDC5eCbF8A7c88f093 contracts/rostrum/src/Rostrum.sol:Rostrum --chain-id 421614 --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
