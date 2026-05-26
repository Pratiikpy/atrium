import type { Alert, ChannelConfig } from '../types.js';

/**
 * Discord webhook delivery. User creates a webhook in their own
 * Discord server (or accepts the Atrium-hosted one) and pastes the
 * URL into /app/settings/notifications. The URL is a bearer secret;
 * we store it encrypted in Vercel KV per docs/conventions/security.md.
 */
export async function deliverDiscord(alert: Alert, config: ChannelConfig): Promise<void> {
  if (!config.discordWebhookUrl) throw new Error('discordWebhookUrl missing');

  const color = alert.severity === 'critical' ? 0xA1352A : alert.severity === 'warning' ? 0xCC8E2D : 0x43864F;
  const embed = {
    title: alert.title,
    description: alert.body,
    color,
    timestamp: new Date(alert.timestamp * 1000).toISOString(),
    fields: [
      ...(alert.txHash ? [{ name: 'Tx', value: `\`${alert.txHash.slice(0, 10)}...${alert.txHash.slice(-4)}\``, inline: true }] : []),
      ...(alert.blockNumber ? [{ name: 'Block', value: String(alert.blockNumber), inline: true }] : []),
      ...(alert.user ? [{ name: 'Wallet', value: `\`${alert.user.slice(0, 6)}...${alert.user.slice(-4)}\``, inline: true }] : []),
    ],
    ...(alert.link ? { url: alert.link } : {}),
    footer: { text: 'Atrium . arb-sepolia' },
  };

  const r = await fetch(config.discordWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!r.ok && r.status !== 204) {
    throw new Error(`discord_${r.status}: ${await r.text()}`);
  }
}
