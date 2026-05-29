#!/usr/bin/env bash
# Subgraph deploy harness for Scribe (Atrium event indexer).
#
# Reads deployed contract addresses from `deploy/arbitrum-sepolia.json`,
# patches `subgraph/subgraph.yaml` in-place (via a temp file), then runs
# the standard codegen → build → deploy chain.
#
# Closes `ATRIUM_12_MONTH_ROADMAP.md` Month-1 task #159.
#
# Usage:
#   ./scripts/subgraph-deploy.sh                  # deploys to The Graph studio
#   ./scripts/subgraph-deploy.sh --local          # deploys to local graph-node
#   ./scripts/subgraph-deploy.sh --check          # codegen + build only (no deploy)
#
# Pre-reqs:
#   - `deploy/arbitrum-sepolia.json` exists with one entry per data source
#     in subgraph.yaml (15 total). Audit U-41: pre-fix this example listed
#     only 12 names + a non-manifest "AqueductReceiver". Operators who
#     copy-pasted the shape would silently skip ResearchAttestation,
#     PraetorTimelock, PosternKeyRegistry, and Curator. The patch logic
#     is data-driven (loops over JSON keys) so the script itself handles
#     any subset; the bug only bites operators who follow this doc.
#     Updated shape (matches subgraph.yaml `name:` entries 1:1):
#     {
#       "Plinth": "0x…", "Coffer": "0x…", "Vigil": "0x…", "Sigil": "0x…",
#       "Aqueduct": "0x…", "Edict": "0x…", "LanternAttestor": "0x…",
#       "PorticoRegistry": "0x…", "Rostrum": "0x…", "PosternKillSwitch": "0x…",
#       "PosternKeyRegistry": "0x…", "AtriumRouter": "0x…", "Curator": "0x…",
#       "ResearchAttestation": "0x…", "PraetorTimelock": "0x…",
#       "_startBlocks": { "Plinth": 12345678, … }
#     }
#   - `graph` CLI auth token in env (`GRAPH_DEPLOY_KEY`) for studio mode
#   - `pnpm` available

set -euo pipefail

MODE="${1:-deploy}"
DEPLOY_FILE="deployments/arbitrum_sepolia.json"

if [ ! -f "${DEPLOY_FILE}" ]; then
    echo "ERROR: ${DEPLOY_FILE} not found."
    echo "Run the contract deploy first (Month-1 task — Praetor CLI deploy)."
    echo "The PorticoRegistry + adapter + AtriumRouter chain must be live"
    echo "before the subgraph can index a meaningful event stream."
    exit 1
fi

cd subgraph

# Phase 4 (SD-13): replaced inline Python patcher with the canonical
# update-subgraph-addresses.mjs script that reads the registry's slug-based
# keys and patches subgraph.yaml addresses + startBlocks.
node ../scripts/update-subgraph-addresses.mjs

pnpm codegen
pnpm build

case "${MODE}" in
    --check)
        echo "Codegen + build only (no deploy)."
        ;;
    --local)
        pnpm create-local || true
        pnpm deploy-local
        ;;
    deploy)
        if [ -z "${GRAPH_DEPLOY_KEY:-}" ]; then
            echo "ERROR: GRAPH_DEPLOY_KEY env not set for studio deploy."
            echo "  export GRAPH_DEPLOY_KEY=<your-key>   # from thegraph.com/studio"
            exit 1
        fi
        graph auth "${GRAPH_DEPLOY_KEY}"
        pnpm deploy
        ;;
    *)
        echo "Unknown mode: ${MODE}"
        exit 1
        ;;
esac

echo
echo "Subgraph deploy run complete."
