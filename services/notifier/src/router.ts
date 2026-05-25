import type { Alert, ChannelConfig, UserNotificationPrefs } from './types.js';
import { shouldDeliver } from './types.js';
import { deliverTelegram } from './channels/telegram.js';
import { deliverDiscord } from './channels/discord.js';
import { deliverEmail } from './channels/email.js';
import { deliverWebhook } from './channels/webhook.js';

/**
 * Route an Alert through every channel the user has enabled, respecting
 * mute lists + severity filters + per-channel destinations. Returns a
 * per-channel delivery report.
 */
export interface DeliveryResult {
  channel: ChannelConfig['kind'];
  success: boolean;
  error?: string;
}

export async function routeAlert(
  alert: Alert,
  prefs: UserNotificationPrefs,
): Promise<DeliveryResult[]> {
  if (prefs.mutedKinds.includes(alert.kind)) {
    return [];
  }
  const results: DeliveryResult[] = [];
  for (const channel of prefs.channels) {
    if (!shouldDeliver(alert, channel)) continue;
    try {
      await deliver(alert, channel);
      results.push({ channel: channel.kind, success: true });
    } catch (err) {
      results.push({
        channel: channel.kind,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

async function deliver(alert: Alert, channel: ChannelConfig): Promise<void> {
  switch (channel.kind) {
    case 'telegram': return deliverTelegram(alert, channel);
    case 'discord':  return deliverDiscord(alert, channel);
    case 'email':    return deliverEmail(alert, channel);
    case 'webhook':  return deliverWebhook(alert, channel);
  }
}
