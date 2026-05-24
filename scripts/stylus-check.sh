#!/usr/bin/env bash
# Local Stylus check via the Dockerfile sandbox (closes human_left.md #11).
#
# Usage:
#   ./scripts/stylus-check.sh [contracts/plinth|contracts/coffer|contracts/vigil|contracts/sigil|all]
#
# Default ("all") runs `cargo stylus check` against all four Stylus contracts.

set -euo pipefail

IMAGE="atrium-stylus"
DOCKERFILE="contracts/stylus.Dockerfile"
TARGET="${1:-all}"

# Build the image if it doesn't exist yet. Subsequent runs reuse the
# cached layers (cargo-stylus install is the expensive step).
if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
    echo "Building ${IMAGE} from ${DOCKERFILE}..."
    docker build -t "${IMAGE}" -f "${DOCKERFILE}" .
fi

run_check() {
    local crate_path="$1"
    echo
    echo "=== cargo stylus check: ${crate_path} ==="
    docker run --rm \
        -v "${PWD}:/workspace" \
        -w "/workspace/${crate_path}" \
        "${IMAGE}" \
        cargo stylus check
}

case "${TARGET}" in
    all)
        run_check contracts/plinth
        run_check contracts/coffer
        run_check contracts/vigil
        run_check contracts/sigil
        ;;
    *)
        run_check "${TARGET}"
        ;;
esac

echo
echo "Stylus check(s) complete."
