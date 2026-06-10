#!/usr/bin/env bash
set -euo pipefail

# Idempotent DigitalOcean droplet provisioning for Atrium daemons.
# Prerequisites: doctl CLI installed, DIGITALOCEAN_ACCESS_TOKEN exported.
# After this script: cloud-init (scripts/cloud-init-droplet.yml) finishes the
# host setup; see subgraph/self-hosted/README.md for the indexer droplet flow.

DROPLET_NAME="atrium-daemons-prod"
REGION="nyc1"
SIZE="s-1vcpu-1gb"
IMAGE="ubuntu-24-04-x64"
TAGS="atrium,daemons,prod"

# --- Auth check ---
if ! doctl auth list &>/dev/null; then
  echo "ERROR: doctl not authenticated. Run: doctl auth init" >&2
  exit 1
fi
echo "✓ doctl authenticated"

# --- SSH key ---
if [[ -z "${DO_SSH_KEY_NAME:-}" ]]; then
  echo "ERROR: Set DO_SSH_KEY_NAME env to your DigitalOcean SSH key name." >&2
  echo "  List keys: doctl compute ssh-key list" >&2
  exit 1
fi

SSH_KEY_ID=$(doctl compute ssh-key list --format Name,ID --no-header | grep "^${DO_SSH_KEY_NAME} " | awk '{print $NF}')
if [[ -z "$SSH_KEY_ID" ]]; then
  echo "ERROR: SSH key '${DO_SSH_KEY_NAME}' not found in your DO account." >&2
  exit 1
fi
echo "✓ SSH key: ${DO_SSH_KEY_NAME} (${SSH_KEY_ID})"

# --- Check existing droplet ---
EXISTING=$(doctl compute droplet list --format Name,ID,PublicIPv4 --no-header | grep "^${DROPLET_NAME} " || true)
if [[ -n "$EXISTING" ]]; then
  IP=$(echo "$EXISTING" | awk '{print $3}')
  echo "✓ Droplet '${DROPLET_NAME}' already exists at ${IP}"
  echo "  ssh root@${IP}"
  exit 0
fi

# --- Create droplet ---
echo "Creating droplet '${DROPLET_NAME}'..."
CLOUD_INIT="$(dirname "$0")/cloud-init-droplet.yml"
CREATE_ARGS=(
  --name "$DROPLET_NAME"
  --region "$REGION"
  --size "$SIZE"
  --image "$IMAGE"
  --ssh-keys "$SSH_KEY_ID"
  --tag-names "$TAGS"
  --wait
)
if [[ -f "$CLOUD_INIT" ]]; then
  CREATE_ARGS+=(--user-data-file "$CLOUD_INIT")
  echo "  Using cloud-init: ${CLOUD_INIT}"
fi

doctl compute droplet create "${CREATE_ARGS[@]}"

# --- Wait and print IP ---
sleep 5
IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "^${DROPLET_NAME} " | awk '{print $2}')
echo ""
echo "═══════════════════════════════════════════"
echo "  Droplet created: ${DROPLET_NAME}"
echo "  IP:              ${IP}"
echo "  SSH:             ssh root@${IP}"
echo "═══════════════════════════════════════════"
echo ""
echo "Next steps: follow runbooks/do-droplet-setup.md"
