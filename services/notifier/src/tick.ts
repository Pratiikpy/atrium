/**
 * Notifier tick: poll Scribe for new alert-class events emitted since
 * the last tick, fan them out via routeAlert.
 *
 * Wired to .github/workflows/notifier-cron.yml on a 1-minute cadence
 * (GHA cron tightest). State persisted via a Vercel KV last-block
 * cursor so reruns are idempotent. Phase eta.5 (2026-05-25).
 *
 * Required env:
 *   SCRIBE_URL                 subgraph query endpoint
 *   ATRIUM_KV_REST_URL         Vercel KV read endpoint
 *   ATRIUM_KV_REST_TOKEN       Vercel KV bearer token
 *   PREFS_API_URL              /api/settings/notifications base
 *   ATRIUM_INTERNAL_KEY        bearer for the prefs API
 *
 * Per-channel env (each optional, missing => channel skipped):
 *   TELEGRAM_BOT_TOKEN, RESEND_API_KEY
 */

import { routeAlert } from './router.js';
import type { Alert, UserNotificationPrefs } from './types.js';

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(process.env.SCRIBE_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(`scribe_${r.status}`);
  const { data, errors } = (await r.json()) as { data?: T; errors?: unknown };
  if (errors) throw new Error('scribe_errors: ' + JSON.stringify(errors));
  if (!data) throw new Error('scribe_empty');
  return data;
}

async function fetchPrefs(user: string): Promise<UserNotificationPrefs | null> {
  const baseUrl = process.env.PREFS_API_URL;
  const key = process.env.ATRIUM_INTERNAL_KEY;
  if (!baseUrl || !key) return null;
  try {
    const r = await fetch(`${baseUrl}?user=${encodeURIComponent(user)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as UserNotificationPrefs;
  } catch {
    return null;
  }
}

async function getCursor(): Promise<number> {
  // Vercel KV via REST. Falls back to env override for local dev.
  const url = process.env.ATRIUM_KV_REST_URL;
  const tok = process.env.ATRIUM_KV_REST_TOKEN;
  if (!url || !tok) {
    return Number(process.env.NOTIFIER_FROM_BLOCK ?? '0');
  }
  try {
    const r = await fetch(`${url}/get/notifier:lastBlock`, { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) return 0;
    const { result } = (await r.json()) as { result: string | null };
    return Number(result ?? '0');
  } catch {
    return 0;
  }
}

async function setCursor(block: number): Promise<void> {
  const url = process.env.ATRIUM_KV_REST_URL;
  const tok = process.env.ATRIUM_KV_REST_TOKEN;
  if (!url || !tok) return;
  await fetch(`${url}/set/notifier:lastBlock/${block}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}` },
  });
}

export async function tickOnce(): Promise<void> {
  const ts = new Date().toISOString();
  const lastBlock = await getCursor();
  console.log(JSON.stringify({ ts, event: 'tick_start', lastBlock }));

  // Pull alert-class events that happened after the cursor. Three
  // subgraph queries: liquidations (vigil), oracle events (plinth),
  // mandate revocations (sigil). All return AlertEvent or similar.
  let data;
  try {
    data = await gql<{
      liquidationEvents: Array<{ id: string; user: string; blockNumber: string; timestamp: string; txHash: string; recoveredCollateralWei: string }>;
      alertEvents: Array<{ id: string; kind: string; blockNumber: string; timestamp: string; txHash: string; detail: string | null }>;
      sigilRevocations: Array<{ id: string; owner: string; agent: string; blockNumber: string; timestamp: string; txHash: string }>;
    }>(
      `query NotifierTick($from: BigInt!) {
        liquidationEvents(where: { blockNumber_gt: $from }, orderBy: blockNumber, orderDirection: asc, first: 100) {
          id user blockNumber timestamp txHash recoveredCollateralWei
        }
        alertEvents(where: { blockNumber_gt: $from }, orderBy: blockNumber, orderDirection: asc, first: 100) {
          id kind blockNumber timestamp txHash detail
        }
        sigilRevocations(where: { blockNumber_gt: $from }, orderBy: blockNumber, orderDirection: asc, first: 100) {
          id owner agent blockNumber timestamp txHash
        }
      }`,
      { from: String(lastBlock) },
    );
  } catch (err) {
    console.error(JSON.stringify({ ts, event: 'scribe_fail', error: String(err) }));
    return;
  }

  const alerts: Alert[] = [];
  for (const ev of data.liquidationEvents) {
    alerts.push({
      kind: 'liquidation_executed',
      severity: 'critical',
      user: ev.user,
      title: 'Liquidation executed',
      body: `Vigil keeper executed a partial liquidation on your account. Recovered collateral: ${ev.recoveredCollateralWei} wei.`,
      link: `https://sepolia.arbiscan.io/tx/${ev.txHash}`,
      blockNumber: Number(ev.blockNumber),
      timestamp: Number(ev.timestamp),
      txHash: ev.txHash,
    });
  }
  for (const ev of data.alertEvents) {
    const kind = mapAlertKind(ev.kind);
    if (!kind) continue;
    alerts.push({
      kind,
      severity: severityFor(kind),
      title: humanTitle(kind),
      body: ev.detail ?? humanTitle(kind),
      link: ev.txHash ? `https://sepolia.arbiscan.io/tx/${ev.txHash}` : undefined,
      blockNumber: Number(ev.blockNumber),
      timestamp: Number(ev.timestamp),
      txHash: ev.txHash,
    });
  }
  for (const ev of data.sigilRevocations) {
    alerts.push({
      kind: 'mandate_revoked',
      severity: 'warning',
      user: ev.owner,
      title: 'Mandate revoked',
      body: `Mandate for agent ${ev.agent.slice(0, 6)}...${ev.agent.slice(-4)} has been revoked.`,
      link: `https://sepolia.arbiscan.io/tx/${ev.txHash}`,
      blockNumber: Number(ev.blockNumber),
      timestamp: Number(ev.timestamp),
      txHash: ev.txHash,
    });
  }

  console.log(JSON.stringify({ ts, event: 'alerts_collected', count: alerts.length }));

  let highestBlock = lastBlock;
  for (const alert of alerts) {
    if (alert.blockNumber && alert.blockNumber > highestBlock) highestBlock = alert.blockNumber;
    if (!alert.user) continue;
    const prefs = await fetchPrefs(alert.user);
    if (!prefs) continue;
    const results = await routeAlert(alert, prefs);
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'alert_routed', kind: alert.kind, user: alert.user, results }));
  }

  if (highestBlock > lastBlock) {
    await setCursor(highestBlock);
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'cursor_advanced', from: lastBlock, to: highestBlock }));
  }
}

function mapAlertKind(scribeKind: string): Alert['kind'] | null {
  switch (scribeKind) {
    case 'ORACLE_DISAGREEMENT': return 'oracle_disagreement';
    case 'PLINTH_PAUSED':       return 'oracle_paused';
    case 'KEEPER_MISSED':       return 'keeper_missed_window';
    case 'COFFER_PAUSED':       return 'coffer_paused';
    case 'AQUEDUCT_LINK_LOW':   return 'aqueduct_link_balance_low';
    case 'KILL_SWITCH':         return 'kill_switch_activated';
    default: return null;
  }
}

function severityFor(kind: Alert['kind']): Alert['severity'] {
  if (kind === 'oracle_paused' || kind === 'coffer_paused' || kind === 'liquidation_executed' || kind === 'kill_switch_activated') return 'critical';
  if (kind === 'oracle_disagreement' || kind === 'keeper_missed_window' || kind === 'aqueduct_link_balance_low' || kind === 'lantern_publish_stalled') return 'warning';
  return 'info';
}

function humanTitle(kind: Alert['kind']): string {
  return kind.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1]?.endsWith('tick.ts') ?? false)) {
  void tickOnce().then(
    () => process.exit(0),
    (err) => {
      console.error(JSON.stringify({ ts: new Date().toISOString(), event: 'fatal', error: String(err) }));
      process.exit(1);
    },
  );
}
