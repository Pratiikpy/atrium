# DNS Provisioning

Records to configure for `useatrium.me` via your registrar (Namecheap, Cloudflare, etc.).

## Required records

| Type  | Host              | Value / Target                          | TTL  | Notes                        |
|-------|-------------------|-----------------------------------------|------|------------------------------|
| CNAME | verify            | cname.vercel-dns.com                    | 300  | Production frontend          |
| CNAME | verify-staging    | cname.vercel-dns.com                    | 300  | Staging preview              |
| A     | codex             | `<DROPLET_IP>`                          | 300  | Caddy auto-TLS → :3000       |
| A     | tablet            | `<DROPLET_IP>`                          | 300  | Caddy auto-TLS → :3001       |
| CNAME | status            | atrium-protocol.github.io               | 300  | Upptime status page          |
| A     | @                 | Vercel IP (76.76.21.21)                 | 300  | Root domain redirect         |
| TXT   | @                 | `v=spf1 include:_spf.google.com ~all`   | 3600 | Email (if using Google Workspace) |

Replace `<DROPLET_IP>` with the IP printed by `scripts/provision-do-droplet.sh`.

## Step-by-step (Namecheap)

1. Log in → Domain List → `useatrium.me` → Advanced DNS.
2. Add each record from the table above.
3. Save all changes.

## Vercel custom domains

After DNS records propagate:

1. Vercel dashboard → Project (atrium-verify) → Settings → Domains.
2. Add `verify.useatrium.me` → assign to Production.
3. Add `verify-staging.useatrium.me` → assign to Preview (branch: `staging`).
4. Vercel will verify DNS automatically.

## Verification

```bash
# Each should resolve correctly
nslookup verify.useatrium.me
nslookup codex.useatrium.me
nslookup tablet.useatrium.me
nslookup status.useatrium.me

# TLS check (after Caddy is running on droplet)
curl -I https://codex.useatrium.me/healthz
curl -I https://tablet.useatrium.me/healthz
```

## Caddyfile reference

The droplet runs Caddy as reverse proxy. See `services/codex/Caddyfile` and `runbooks/caddy-on-droplet.md` for installation.

Combined Caddyfile installed at `/etc/caddy/Caddyfile`:

```
codex.useatrium.me {
  reverse_proxy localhost:3000
}

tablet.useatrium.me {
  reverse_proxy localhost:3001
}
```

Caddy handles TLS certificate provisioning via Let's Encrypt ACME automatically.
