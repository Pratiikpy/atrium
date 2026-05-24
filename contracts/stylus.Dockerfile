# Stylus build sandbox for local development on Windows / non-Linux hosts.
#
# Closes `human_left.md` #11 — local Stylus builds were blocked on Windows
# MSVC. CI on ubuntu-latest works (see .github/workflows/ci.yml, the
# `test-rust` and `kani` jobs). This Dockerfile gives developers the same
# environment locally so they don't have to wait for a CI roundtrip on
# every Stylus contract change.
#
# Usage:
#   docker build -t atrium-stylus -f contracts/stylus.Dockerfile .
#   docker run --rm -v "${PWD}:/workspace" -w /workspace atrium-stylus \
#     bash -lc "cd contracts/plinth && cargo stylus check"
#
# Or via the helper script (committed alongside this file):
#   ./scripts/stylus-check.sh contracts/plinth

FROM rust:1.92-bookworm

# System deps that cargo-stylus needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        libudev-dev \
        clang \
        cmake \
        git \
    && rm -rf /var/lib/apt/lists/*

# wasm32 target for Stylus.
RUN rustup target add wasm32-unknown-unknown

# Pre-install cargo-stylus so the container is ready to go. Version pinned
# to match the version used in CI (`cargo install --force cargo-stylus`
# without a version yields the latest from crates.io; pin once we observe
# a Stylus toolchain regression — see `.claude/rules/security.md` "Stylus
# toolchain regression" entry).
# Pinned to 0.5.x — matches the stylus-sdk = "0.6" used by Atrium contracts.
# Newer cargo-stylus (0.10+) requires Stylus.toml manifests we haven't authored.
RUN cargo install --force cargo-stylus --version 0.5.6

# Workspace stays as a volume mount; nothing to copy at image-build time.
WORKDIR /workspace

# Default to dropping into bash so an interactive container is usable.
CMD ["/bin/bash"]
