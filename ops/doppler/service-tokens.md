# Doppler Service Tokens

Per-service read-only tokens for daemon processes on the DO droplet.

## Overview

Each daemon (notifier, vigil-keeper, lantern-attestor) gets its own Doppler service token scoped to a single config. Tokens are stored on the droplet and read by pm2 at startup.

## Creating tokens

For each service, run from a machine with Doppler CLI authenticated as admin:

```bash
# notifier
doppler configs tokens create \
  --project atrium \
  --config prd_notifier \
  --name "droplet-notifier" \
  --max-age 0

# vigil-keeper
doppler configs tokens create \
  --project atrium \
  --config prd_vigil-keeper \
  --name "droplet-vigil-keeper" \
  --max-age 0

# lantern-attestor
doppler configs tokens create \
  --project atrium \
  --config prd_lantern-attestor \
  --name "droplet-lantern-attestor" \
  --max-age 0
```

Each command prints a token like `dp.st.prod.xxxx`. Copy it immediately (shown only once).

## Storing on droplet

SSH into the droplet and create env files:

```bash
# /etc/atrium/notifier.env
echo "DOPPLER_TOKEN=dp.st.prod.xxxx" > /etc/atrium/notifier.env
chmod 600 /etc/atrium/notifier.env

# /etc/atrium/vigil-keeper.env
echo "DOPPLER_TOKEN=dp.st.prod.yyyy" > /etc/atrium/vigil-keeper.env
chmod 600 /etc/atrium/vigil-keeper.env

# /etc/atrium/lantern-attestor.env
echo "DOPPLER_TOKEN=dp.st.prod.zzzz" > /etc/atrium/lantern-attestor.env
chmod 600 /etc/atrium/lantern-attestor.env
```

## Usage with pm2

Each service's `ecosystem.config.cjs` uses `doppler run` to inject secrets:

```bash
cd /opt/atrium
pm2 start services/notifier/ecosystem.config.cjs
pm2 start services/vigil-keeper/ecosystem.config.cjs
pm2 start services/lantern-attestor/ecosystem.config.cjs
```

The ecosystem configs reference the Doppler token from the env file. Example pattern:

```js
module.exports = {
  apps: [{
    name: 'notifier',
    script: 'doppler',
    args: 'run -- node src/index.js',
    env: { DOPPLER_TOKEN: '' }, // loaded from /etc/atrium/notifier.env
  }]
};
```

## Token rotation

1. Create a new token (same command as above, different `--name`).
2. Update `/etc/atrium/<service>.env` on the droplet.
3. `pm2 restart <service>`.
4. Revoke old token: `doppler configs tokens revoke --project atrium --config prd_<service> --token <old-token>`.

## Security notes

- Tokens are read-only (cannot modify secrets via the token).
- Scoped to a single config (one service cannot read another's secrets).
- `/etc/atrium/*.env` files are `chmod 600` (root-only readable).
- Never commit tokens to the repo.
