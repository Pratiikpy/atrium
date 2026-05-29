# Discord Server Setup

Human-action runbook for creating the Atrium Discord server.

## Steps

### 1. Create server

1. Open [discord.com](https://discord.com) → "Add a Server" → "Create My Own" → "For a club or community".
2. Name: **Atrium**.
3. Upload server icon (use `apps/verify/public/brand/atrium-icon.svg` or equivalent).

### 2. Create channels

| Channel              | Category   | Permissions          |
|----------------------|------------|----------------------|
| `#announcements`     | General    | Mod-only send        |
| `#general`           | General    | Everyone             |
| `#dev`               | Dev        | Everyone             |
| `#bug-reports`       | Dev        | Everyone             |
| `#ops-alerts`        | Ops        | Webhook target, read-only for members |
| `#audit-disclosure`  | Ops        | Private (founders + auditors only) |

### 3. Create webhook for ops-alerts

1. Server Settings → Integrations → Webhooks → New Webhook.
2. Name: `Atrium Ops`.
3. Channel: `#ops-alerts`.
4. Copy webhook URL.
5. Store in Doppler: `DISCORD_OPS_WEBHOOK` (all environments).
6. Also add as GitHub repo secret: `DISCORD_OPS_WEBHOOK`.

### 4. Invite link

- If server boost level ≥ 3: set vanity URL `discord.gg/atrium`.
- Otherwise: create a permanent invite link (never expires, unlimited uses).
- Update `apps/verify/src/components/landing/footer.tsx` with the real invite link.
- If using a redirect (`https://atrium.fi/discord`), configure that redirect in DNS/Vercel.

### 5. Roles

| Role               | Color   | Permissions                |
|--------------------|---------|----------------------------|
| `@founder`         | Gold    | Admin                      |
| `@dev`             | Blue    | Manage messages in dev channels |
| `@verified-tester` | Green   | Access to beta channels    |

### 6. Server settings

- Verification level: Medium (must have verified email + 5 min wait).
- Explicit content filter: Scan messages from all members.
- Default notification: Only @mentions.

## Verification

- Post a test message in `#ops-alerts` via the webhook:
  ```bash
  curl -X POST "$DISCORD_OPS_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d '{"content":"✅ Webhook test from Atrium ops"}'
  ```
- Confirm it appears in the channel.
