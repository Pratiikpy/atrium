# Self-hosted Scribe (graph-node) — the permanent fix for Studio outages

Atrium's subgraph ("Scribe") was on **The Graph Studio's free testnet tier**, which on
2026-06-10 **froze its indexer** (stuck at block 275099999 while the chain was at 275.76M)
**and 504'd its deploy endpoint** — taking the flagship Proof-of-Reserves and on-chain
position lists stale. This is a recurring Studio failure (see the project memory).

Per `CLAUDE.md` ("Free tier is the design constraint. If a service has no free tier, prefer
self-hosting on the $5 VPS"), this directory runs a **graph-node we control**. It reads
Arbitrum Sepolia directly via RPC, so it **cannot freeze the way Studio did** — if it falls
behind, it keeps catching up; it never depends on a third party's hosted indexer.

Proven 2026-06-10: graph-node connected to Arbitrum Sepolia (network 421614, archive +
traces), the subgraph deployed, and indexing started — all locally. (Local persistent run
is flaky only on **Windows Docker Desktop**; on a Linux VPS Docker is solid.)

## Deploy on the $5 VPS (production)

```bash
# 1. Install Docker on the VPS (Ubuntu): curl -fsSL https://get.docker.com | sh
# 2. Copy this repo (or just subgraph/ + subgraph/self-hosted/) to the VPS.
# 3. Use a real archive RPC for fast sync (public node works but is slow):
export ETHEREUM_RPC="https://arb-sepolia.g.alchemy.com/v2/<YOUR_FREE_ALCHEMY_KEY>"
# 4. Bring up graph-node + postgres + ipfs:
docker compose -f subgraph/self-hosted/docker-compose.yml up -d
# 5. Deploy the subgraph + start indexing:
bash subgraph/self-hosted/deploy.sh
# 6. Open port 8000 (firewall) and confirm:
curl -s http://<vps-ip>:8000/subgraphs/name/atrium-local \
  -d '{"query":"{ _meta { block { number } } }"}' -H 'content-type: application/json'
```

Wait until `_meta.block.number` reaches the chain tip (watch it climb). With an Alchemy
free-tier RPC the ~5.3M-block backfill is far faster than the public node. To skip history
and only index recent activity, bump every `startBlock:` in `subgraph/subgraph.yaml` to a
recent block before deploying.

## Point the app at it

Set `SCRIBE_URL` to `http://<vps-ip>:8000/subgraphs/name/atrium-local` in **three** places
(the domain-migration lesson: env values hide in multiple spots):

1. **Vercel prod** project env (`SCRIBE_URL`) → redeploy the app
2. **Lantern GHA secret** `SCRIBE_URL` (so the PoR attestor reads the live indexer)
3. `apps/verify/.env.local` (local dev)

Put graph-node behind Caddy/nginx with TLS for a clean `https://scribe.useatrium.me`.

## Operate

- Status:  `curl localhost:8030/graphql -d '{"query":"{indexingStatuses{synced health chains{latestBlock{number} chainHeadBlock{number}}}}"}' -H 'content-type: application/json'`
- Logs:    `docker compose -f subgraph/self-hosted/docker-compose.yml logs -f graph-node`
- Restart: `docker compose -f subgraph/self-hosted/docker-compose.yml restart graph-node`
- Data persists in `subgraph/self-hosted/data/` (gitignored).
