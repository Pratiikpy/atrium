#!/bin/sh
set -e
cd /work
forge verify-contract 0xf134127cc2762d3ebc5645aba6c99cd5a8b82717 contracts/atrium-router/src/AtriumRouter.sol:AtriumRouter --chain-id 421614 --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
echo
forge verify-contract 0xbaf348e61fb555844973398b51332d93f674b0af contracts/rostrum/src/Rostrum.sol:Rostrum --chain-id 421614 --verifier sourcify --watch 2>&1 | grep -E "Status|verified|already|Error" | head -3
