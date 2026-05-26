#!/usr/bin/env bash
#
# Phase eta.14 (2026-05-25): one-shot full-history secret scan for the
# pre-public-flip audit. Per docs/conventions/git.md and the
# 2026-05-24 deployer key leak incident, every commit must be clean
# before the repo flips public.
#
# Usage:
#   bash scripts/audit-history.sh
#
# Requires: gitleaks (https://github.com/gitleaks/gitleaks). Install:
#   brew install gitleaks                    # macOS
#   sudo apt install gitleaks                # Debian/Ubuntu
#   choco install gitleaks                   # Windows + Chocolatey
#   docker run ghcr.io/gitleaks/gitleaks:latest ...   # any OS

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks not on PATH."
  echo "Install: https://github.com/gitleaks/gitleaks#installing"
  echo "Or run via docker:"
  echo "  docker run --rm -v \"$REPO_ROOT:/repo\" ghcr.io/gitleaks/gitleaks:latest detect --source /repo --log-opts=\"--all\""
  exit 1
fi

echo "Scanning full git history with gitleaks..."
gitleaks detect \
  --source "$REPO_ROOT" \
  --log-opts="--all" \
  --no-banner \
  --report-format json \
  --report-path "/tmp/atrium-gitleaks-$(date +%Y%m%d-%H%M%S).json" \
  --redact

EXIT=$?
if [ $EXIT -eq 0 ]; then
  echo ""
  echo "Clean. No leaked secrets across full history."
  echo "Repo is safe to flip public from a secret-scan perspective."
else
  echo ""
  echo "FINDINGS DETECTED. Review the JSON report path printed above."
  echo "For each finding:"
  echo "  1. Rotate the secret immediately (it is already in history)."
  echo "  2. Decide whether to rewrite history (git filter-repo) or"
  echo "     leave it with the rotation documented in incidents/."
  echo "  3. Re-run this script after rotation to confirm clean."
  exit 1
fi
