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
DEPLOY_FILE="deploy/arbitrum-sepolia.json"

if [ ! -f "${DEPLOY_FILE}" ]; then
    echo "ERROR: ${DEPLOY_FILE} not found."
    echo "Run the contract deploy first (Month-1 task — Praetor CLI deploy)."
    echo "The PorticoRegistry + adapter + AtriumRouter chain must be live"
    echo "before the subgraph can index a meaningful event stream."
    exit 1
fi

cd subgraph

# Patch addresses. The manifest currently has 0x000…0 placeholders for every
# `source.address` field. The substitution is keyed off the `name:` field
# immediately before each `source:` block.
python3 - <<'PY'
import json, re, sys, pathlib

manifest_path = pathlib.Path("subgraph.yaml")
deploy_path = pathlib.Path("../deploy/arbitrum-sepolia.json")
deploy = json.loads(deploy_path.read_text())
start_blocks = deploy.pop("_startBlocks", {})

src = manifest_path.read_text()

def patch(name, contract_addr, start_block):
    global src
    # Find the `- name: <name>` block, then the next `source:` and patch
    # the address + startBlock lines inside that block.
    pattern = re.compile(
        r"(- (?:name|kind): " + re.escape(name) + r"\n[\s\S]*?source:\n[\s\S]*?)"
        r'address: "0x0+"\n([\s\S]*?startBlock: )\d+',
        re.MULTILINE,
    )
    def repl(m):
        return m.group(1) + f'address: "{contract_addr}"\n' + m.group(2) + str(start_block)
    new, n = pattern.subn(repl, src, count=1)
    if n == 0:
        print(f"WARN: no patch site found for {name} (placeholder may already be filled)")
    src = new

for name, addr in deploy.items():
    sb = start_blocks.get(name, 0)
    patch(name, addr, sb)

manifest_path.write_text(src)
print("Manifest patched.")
PY

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
