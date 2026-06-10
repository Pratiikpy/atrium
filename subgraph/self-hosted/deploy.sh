#!/usr/bin/env bash
# Deploy the Atrium subgraph to the self-hosted Scribe node.
# Run from repo root after `docker compose -f ops/scribe-node/docker-compose.yml up -d`.
#
# Local:  ops/scribe-node/deploy.sh
# VPS:    same, after copying the repo (or just subgraph/ + ops/scribe-node/) to the box.
set -euo pipefail

NODE="${GRAPH_NODE_ADMIN:-http://localhost:8020/}"
IPFS="${GRAPH_NODE_IPFS:-http://localhost:5001}"
NAME="${SUBGRAPH_NAME:-atrium-local}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$ROOT/subgraph"
echo "→ codegen + build"
pnpm exec graph codegen >/dev/null
pnpm exec graph build  >/dev/null

echo "→ create $NAME on $NODE (idempotent)"
pnpm exec graph create --node "$NODE" "$NAME" 2>/dev/null || true

echo "→ deploy + start indexing"
pnpm exec graph deploy --node "$NODE" --ipfs "$IPFS" "$NAME" --version-label "v$(date +%Y%m%d-%H%M)" || \
pnpm exec graph deploy --node "$NODE" --ipfs "$IPFS" "$NAME" --version-label v1

echo ""
echo "✓ Scribe is indexing. Query endpoint:"
echo "    http://<this-host>:8000/subgraphs/name/$NAME"
echo ""
echo "Point SCRIBE_URL at it (local + Vercel prod env + Lantern GHA secret), then redeploy the app."
