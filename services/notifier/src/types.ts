/**
 * Atrium notifier types. Phase 2c (2026-05-28).
 *
 * Events sourced from Scribe subgraph + on-chain reads. Each event
 * routes to per-user channel preferences via router.ts.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Canonical alert kinds. The LOWERCASE values match what subgraph handlers
 * actually emit into AlertEvent.kind. The notifier maps additional kinds
 * (liquidation_executed, mandate_revoked, kill_switch_activated) that come
 * from non-AlertEvent entities.
 */
export const ALERT_KIND = {
  // Subgraph AlertEvent.kind values (lowercase, match handlers)
  oracle_disagreement: 'oracle_disagreement',
  vigil_queue_failed: 'vigil_queue_failed',
  link_balance_low: 'link_balance_low',
  usdc_paused: 'usdc_paused',
  adapter_emergency_deregistered: 'adapter_emergency_deregistered',
  emergency_pause_invoked: 'emergency_pause_invoked',
  // Notifier-mapped kinds (from non-AlertEvent entities)
  liquidation_executed: 'liquidation_executed',
  mandate_revoked: 'mandate_revoked',
  kill_switch_activated: 'kill_switch_activated',
} as const;

export type AlertKind = (typeof ALERT_KIND)[keyof typeof ALERT_KIND];

export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  user?: string;        // wallet address if user-specific
  title: string;        // short headline
  body: string;         // markdown body
  link?: string;        // arbiscan / useatrium.me URL
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
