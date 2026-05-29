# Status Page Setup

Upptime-based status page at `status.atrium.fi`.

## Prerequisites

- GitHub repo `atrium-protocol/atrium` (or actual org/repo)
- `DISCORD_OPS_WEBHOOK` secret set in repo settings
- `SCRIBE_URL` secret set (subgraph endpoint)

## Steps

### 1. Push config

The `.upptimerc.yml` at repo root and `.github/workflows/upptime.yml` are already committed. Push to `main`.

### 2. Enable GitHub Pages

1. Go to repo **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `status` / `/ (root)`.
4. Save.

The Upptime workflow auto-creates the `status` branch on first run.

### 3. Add CNAME record

In your DNS registrar (Namecheap / Cloudflare / etc.):

| Type  | Host     | Value                            | TTL  |
|-------|----------|----------------------------------|------|
| CNAME | status   | atrium-protocol.github.io        | 300  |

### 4. Verify

```bash
nslookup status.atrium.fi
# Should resolve to GitHub Pages IPs

curl -I https://status.atrium.fi
# Should return 200 with valid TLS
```

### 5. Custom domain in GitHub Pages

After DNS propagates:
1. Settings → Pages → Custom domain → `status.atrium.fi`
2. Check "Enforce HTTPS"

## Troubleshooting

- If the `status` branch doesn't appear, manually trigger the Upptime workflow via Actions → Upptime → Run workflow.
- If Pages shows 404, ensure the branch has an `index.html` (Upptime generates it).
- DNS propagation can take up to 48h; typically <10 min with low TTL.
