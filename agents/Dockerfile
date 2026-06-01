# Multi-stage build for the three reference Atrium agents
# (Augur, Haruspex, Auspex). Builds the whole Cargo workspace
# in one pass since all three share dependencies, then ships
# each binary in a minimal runtime image.

FROM rust:1.92-bookworm AS builder

WORKDIR /build

# Copy workspace metadata first so the dependency graph caches even
# when only application code changes.
COPY Cargo.toml Cargo.lock ./
COPY agents/augur/Cargo.toml agents/augur/
COPY agents/haruspex/Cargo.toml agents/haruspex/
COPY agents/auspex/Cargo.toml agents/auspex/
COPY agents/template/Cargo.toml agents/template/
COPY services/praetor-cli/Cargo.toml services/praetor-cli/

# Empty src directories so the first cargo build can resolve everything
# without needing real source files. Then real source replaces them and
# only the final-binary-link step has to redo.
RUN mkdir -p agents/augur/src agents/haruspex/src agents/auspex/src agents/template/src services/praetor-cli/src && \
    echo 'fn main(){}' | tee agents/augur/src/main.rs agents/haruspex/src/main.rs agents/auspex/src/main.rs agents/template/src/main.rs services/praetor-cli/src/main.rs

# Pre-fetch deps. Failure here usually means a missing system lib -
# add it via apt-get above.
RUN cargo fetch --locked

# Now bring in the real source.
COPY agents agents
COPY services services

# Build the three reference agents in release mode.
RUN cargo build --release --bin augur --bin haruspex --bin auspex

# -----------------------------------------------------------------------------
# Runtime stage, tiny image with just the binaries and CA certificates.
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# OpenSSL + CA certs needed for outbound HTTPS (Codex API, RPC).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Run as a dedicated non-root user (security hardening, the runtime only
# needs to execute the binaries and write its state dir).
RUN useradd --system --uid 10001 --user-group --no-create-home atrium

WORKDIR /app
COPY --from=builder /build/target/release/augur /app/augur
COPY --from=builder /build/target/release/haruspex /app/haruspex
COPY --from=builder /build/target/release/auspex /app/auspex

# State persistence directory. Bind-mounted from the host, so the host path
# must be writable by uid 10001 (chown the mount, or set `user: "10001"` on
# the docker-compose service).
RUN mkdir -p /var/atrium/state && chown -R atrium:atrium /var/atrium/state /app

USER atrium

# Default to a no-op CMD; docker-compose overrides per-service.
CMD ["/bin/sh", "-c", "echo 'set CMD via compose to choose an agent'; exit 1"]
