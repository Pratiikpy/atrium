# Caddy on Droplet

Install and configure Caddy as reverse proxy on the Atrium daemons droplet.

## Prerequisites

- Droplet provisioned via `scripts/provision-do-droplet.sh`
- DNS A records for `codex.atrium.fi` and `tablet.atrium.fi` pointing to droplet IP
- Ports 80 and 443 open (handled by cloud-init UFW rules)

## Install

If cloud-init already ran, Caddy is installed. Otherwise:

```bash
apt install -y caddy
```

## Configure

1. Create the combined Caddyfile:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
codex.atrium.fi {
  reverse_proxy localhost:3000
}

tablet.atrium.fi {
  reverse_proxy localhost:3001
}
EOF
```

2. Validate:
```bash
caddy validate --config /etc/caddy/Caddyfile
```

3. Reload:
```bash
systemctl reload caddy
```

## Verify

```bash
# Check Caddy is running
systemctl status caddy

# Test TLS + proxy (after DNS propagates)
curl -I https://codex.atrium.fi/healthz
# Expected: HTTP/2 200, valid Let's Encrypt cert

curl -I https://tablet.atrium.fi/healthz
# Expected: HTTP/2 200
```

## How it works

- Caddy automatically provisions TLS certificates via Let's Encrypt ACME.
- No manual cert management needed.
- Certificates auto-renew ~30 days before expiry.
- Caddy listens on 80 (redirect to HTTPS) and 443.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ERR_CONNECTION_REFUSED` | Check `systemctl status caddy`, ensure ports 80/443 open in UFW |
| TLS handshake failure | DNS not propagated yet; wait or check `nslookup` |
| 502 Bad Gateway | Backend service not running; check `pm2 status` |
| Certificate error | Ensure DNS A record points to this droplet's IP (not proxied through Cloudflare orange-cloud) |

## Adding new services

1. Add a new block to `/etc/caddy/Caddyfile`.
2. Add DNS A record for the new subdomain.
3. `systemctl reload caddy` — Caddy auto-provisions the cert.
