/**
 * Atrium notifier types. Phase eta.5 (2026-05-25).
 *
 * Events sourced from Scribe subgraph + on-chain reads. Each event
 * routes to per-user channel preferences via router.ts.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertKind =
  | 'liquidation_executed'
  | 'liquidation_queued'
  | 'oracle_disagreement'
  | 'oracle_paused'
  | 'keeper_missed_window'
  | 'coffer_paused'
  | 'aqueduct_link_balance_low'
  | 'lantern_publish_stalled'
  | 'mandate_revoked'
  | 'kill_switch_activated';

export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  user?: string;        // wallet address if user-specific
  title: string;        // short headline
  body: string;         // markdown body
  link?: string;        // arbiscan / verify.atrium.fi URL
  blockNumber?: number;
  timestamp: number;    // unix seconds
  txHash?: string;
}

export type ChannelKind = 'telegram' | 'discord' | 'email' | 'webhook';

export interface ChannelConfig {
  kind: ChannelKind;
  enabled: boolean;
  // Channel-specific destination.
  telegramChatId?: string;
  discordWebhookUrl?: string;
  emailAddress?: string;
  customWebhookUrl?: string;
  // Severity filter; only alerts at or above this level are delivered.
  minSeverity: AlertSeverity;
}

export interface UserNotificationPrefs {
  user: string; // wallet address
  channels: ChannelConfig[];
  // Per-alert-kind opt-out so users can mute specific event types
  // (e.g. mute oracle_disagreement if they are not actively trading).
  mutedKinds: AlertKind[];
}

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export function shouldDeliver(alert: Alert, config: ChannelConfig): boolean {
  if (!config.enabled) return false;
  return SEVERITY_RANK[alert.severity] >= SEVERITY_RANK[config.minSeverity];
}
