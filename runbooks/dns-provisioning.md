# DNS Provisioning

Records to configure for `atrium.fi` via your registrar (Namecheap, Cloudflare, etc.).

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

1. Log in → Domain List → `atrium.fi` → Advanced DNS.
2. Add each record from the table above.
3. Save all changes.

## Vercel custom domains

After DNS records propagate:

1. Vercel dashboard → Project (atrium-verify) → Settings → Domains.
2. Add `verify.atrium.fi` → assign to Production.
3. Add `verify-staging.atrium.fi` → assign to Preview (branch: `staging`).
4. Vercel will verify DNS automatically.

## Verification

```bash
# Each should resolve correctly
nslookup verify.atrium.fi
nslookup codex.atrium.fi
nslookup tablet.atrium.fi
nslookup status.atrium.fi

# TLS check (after Caddy is running on droplet)
curl -I https://codex.atrium.fi/healthz
curl -I https://tablet.atrium.fi/healthz
```

## Caddyfile reference

The droplet runs Caddy as reverse proxy. See `services/codex/Caddyfile` and `runbooks/caddy-on-droplet.md` for installation.

Combined Caddyfile installed at `/etc/caddy/Caddyfile`:

```
codex.atrium.fi {
  reverse_proxy localhost:3000
}

tablet.atrium.fi {
  reverse_proxy localhost:3001
}
```

Caddy handles TLS certificate provisioning via Let's Encrypt ACME automatically.
