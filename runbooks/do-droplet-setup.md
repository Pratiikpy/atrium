# DigitalOcean Droplet Setup

Bring-up procedure for the Atrium off-chain services droplet (Phase 7).

## Droplet Spec

- Region: NYC1 (or closest to Arbitrum Sepolia RPC)
- Size: s-2vcpu-4gb ($24/mo)
- OS: Ubuntu 24.04 LTS
- Monitoring: enabled

## Initial Setup

```bash
# SSH in as root
ssh root@<droplet-ip>

# Create service user
useradd -m -s /bin/bash atrium
mkdir -p /srv/atrium /var/log/{notifier,vigil-keeper,lantern-attestor}
chown -R atrium:atrium /srv/atrium /var/log/{notifier,vigil-keeper,lantern-attestor}

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh
```

## Deploy Services

```bash
su - atrium

# Clone and build
cd /srv/atrium
git clone <repo-url> .
cd services/notifier && npm ci && npm run build && cd ../..
cd services/vigil-keeper && npm ci && npm run build && cd ../..
cd services/lantern-attestor && npm ci && npm run build && cd ../..

# Configure Doppler
doppler login
doppler setup --project atrium --config staging
```

## Environment Variables (via Doppler)

### Notifier
- `SCRIBE_URL`
- `SENDGRID_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `SENTRY_DSN`

### Vigil-Keeper
- `KEEPER_PRIVATE_KEY`
- `ARBITRUM_SEPOLIA_RPC`
- `VIGIL_ADDRESS`
- `SENTRY_DSN`

### Lantern-Attestor
- `LANTERN_ATTESTOR_ADDRESS`
- `COFFER_ADDRESS`
- `SCRIBE_URL`
- `ARBITRUM_SEPOLIA_RPC`
- `LANTERN_SIGNER_KEY`
- `WEB3_STORAGE_TOKEN`
- `SENTRY_DSN`

## Start Services

```bash
# Start all three via PM2
cd /srv/atrium/services/notifier && pm2 start ecosystem.config.cjs
cd /srv/atrium/services/vigil-keeper && pm2 start ecosystem.config.cjs
cd /srv/atrium/services/lantern-attestor && pm2 start ecosystem.config.cjs

# Save PM2 process list for auto-restart on reboot
pm2 save
pm2 startup systemd -u atrium --hp /home/atrium
```

## Monitoring

```bash
pm2 status
pm2 logs atrium-notifier --lines 50
pm2 monit
```

## Rotation / Updates

```bash
cd /srv/atrium && git pull
cd services/notifier && npm ci && npm run build
pm2 restart atrium-notifier
# Repeat for other services
```
