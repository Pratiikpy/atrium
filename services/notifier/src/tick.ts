/**
 * Notifier tick: poll Scribe for new alert-class events emitted since
 * the last tick, fan them out via routeAlert.
 *
 * Phase 2c fixes:
 *   - Lowercase alert kinds matching subgraph handlers
 *   - Cursor pagination (blockNumber_gt loop, no dropped events)
 *   - Fetch timeout (5s AbortSignal)
 *   - _meta health check (skip tick if indexer lag > 200 blocks)
 *
 * Required env:
 *   SCRIBE_URL                 subgraph query endpoint
 *   ATRIUM_KV_REST_URL         Vercel KV read endpoint
 *   ATRIUM_KV_REST_TOKEN       Vercel KV bearer token
 *   PREFS_API_URL              /api/settings/notifications base
 *   ATRIUM_INTERNAL_KEY        bearer for the prefs API
 *   CHAIN_HEAD_BLOCK           (optional) override for health check
 */

import { routeAlert } from './router.js';
import { ALERT_KIND } from './types.js';
import type { Alert, AlertKind, UserNotificationPrefs } from './types.js';
import { heartbeat } from './heartbeat.js';

const FETCH_TIMEOUT_MS = 5000;
const PAGE_SIZE = 100;
const MAX_INDEXER_LAG = 200;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(process.env.SCRIBE_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`scribe_${r.status}`);
  const { data, errors } = (await r.json()) as { data?: T; errors?: unknown };
  if (errors) throw new Error('scribe_errors: ' + JSON.stringify(errors));
  if (!data) throw new Error('scribe_empty');
  return data;
}

async function checkIndexerHealth(): Promise<{ healthy: boolean; indexedBlock: number }> {
  const data = await gql<{ _meta: { block: { number: number } } }>(
    `{ _meta { block { number } } }`,
    {},
  );
  const indexedBlock = data._meta.block.number;
  const chainHead = Number(process.env.CHAIN_HEAD_BLOCK ?? '0');
  // If we don't know the chain head, skip the lag check
  if (!chainHead) return { healthy: true, indexedBlock };
  const lag = chainHead - indexedBlock;
  return { healthy: lag <= MAX_INDEXER_LAG, indexedBlock };
}

async function fetchPrefs(user: string): Promise<UserNotificationPrefs | null> {
  const baseUrl = process.env.PREFS_API_URL;
  const key = process.env.ATRIUM_INTERNAL_KEY;
  if (!baseUrl || !key) return null;
  try {
    const r = await fetch(`${baseUrl}?user=${encodeURIComponent(user)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    return (await r.json()) as UserNotificationPrefs;
  } catch {
    return null;
  }
}

async function getCursor(): Promise<number> {
  const url = process.env.ATRIUM_KV_REST_URL;
  const tok = process.env.ATRIUM_KV_REST_TOKEN;
  if (!url || !tok) {
    return Number(process.env.NOTIFIER_FROM_BLOCK ?? '0');
  }
  try {
    const r = await fetch(`${url}/get/notifier:lastBlock`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/** Paginate through all events since cursor using blockNumber_gt */
async function fetchAllAlertEvents(cursor: number): Promise<Array<{ id: string; kind: string; blockNumber: string; timestamp: string; txHash: string; detail: string | null }>> {
  const results: Array<{ id: string; kind: string; blockNumber: string; timestamp: string; txHash: string; detail: string | null }> = [];
  let currentCursor = cursor;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ alertEvents: typeof results }>(
      `query AlertPage($cursor: BigInt!) {
        alertEvents(where: { blockNumber_gt: $cursor }, orderBy: blockNumber, orderDirection: asc, first: ${PAGE_SIZE}) {
          id kind blockNumber timestamp txHash detail
        }
      }`,
      { cursor: String(currentCursor) },
    );
    if (!data.alertEvents.length) break;
    results.push(...data.alertEvents);
    currentCursor = Number(data.alertEvents[data.alertEvents.length - 1].blockNumber);
    if (data.alertEvents.length < PAGE_SIZE) break;
  }
  return results;
}

async function fetchAllLiquidations(cursor: number): Promise<Array<{ id: string; user: string; blockNumber: string; timestamp: string; txHash: string; recoveredCollateralWei: string }>> {
  const results: Array<{ id: string; user: string; blockNumber: string; timestamp: string; txHash: string; recoveredCollateralWei: string }> = [];
  let currentCursor = cursor;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ liquidationEvents: typeof results }>(
      `query LiqPage($cursor: BigInt!) {
        liquidationEvents(where: { blockNumber_gt: $cursor }, orderBy: blockNumber, orderDirection: asc, first: ${PAGE_SIZE}) {
          id user blockNumber timestamp txHash recoveredCollateralWei
        }
      }`,
      { cursor: String(currentCursor) },
    );
    if (!data.liquidationEvents.length) break;
    results.push(...data.liquidationEvents);
    currentCursor = Number(data.liquidationEvents[data.liquidationEvents.length - 1].blockNumber);
    if (data.liquidationEvents.length < PAGE_SIZE) break;
  }
  return results;
}

async function fetchAllRevocations(cursor: number): Promise<Array<{ id: string; owner: string; agent: string; blockNumber: string; timestamp: string; txHash: string }>> {
  const results: Array<{ id: string; owner: string; agent: string; blockNumber: string; timestamp: string; txHash: string }> = [];
  let currentCursor = cursor;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ sigilRevocations: typeof results }>(
      `query RevPage($cursor: BigInt!) {
        sigilRevocations(where: { blockNumber_gt: $cursor }, orderBy: blockNumber, orderDirection: asc, first: ${PAGE_SIZE}) {
          id owner agent blockNumber timestamp txHash
        }
      }`,
      { cursor: String(currentCursor) },
    );
    if (!data.sigilRevocations.length) break;
    results.push(...data.sigilRevocations);
    currentCursor = Number(data.sigilRevocations[data.sigilRevocations.length - 1].blockNumber);
    if (data.sigilRevocations.length < PAGE_SIZE) break;
  }
  return results;
}

export async function tickOnce(): Promise<void> {
  const ts = new Date().toISOString();

  // Audit fix (#56): signal liveness (no-ops when HONEYBADGER_HEARTBEAT_URL unset).
  await heartbeat('notifier');

  // _meta health check: skip tick if indexer is lagging
  try {
    const { healthy, indexedBlock } = await checkIndexerHealth();
    if (!healthy) {
      console.warn(JSON.stringify({ ts, event: 'indexer_lag_skip', indexedBlock }));
      return;
    }
  } catch (err) {
    console.error(JSON.stringify({ ts, event: 'health_check_fail', error: String(err) }));
    return;
  }

  const lastBlock = await getCursor();
  console.log(JSON.stringify({ ts, event: 'tick_start', lastBlock }));

  let liquidationEvents: Awaited<ReturnType<typeof fetchAllLiquidations>>;
  let alertEvents: Awaited<ReturnType<typeof fetchAllAlertEvents>>;
  let sigilRevocations: Awaited<ReturnType<typeof fetchAllRevocations>>;

  try {
    [liquidationEvents, alertEvents, sigilRevocations] = await Promise.all([
      fetchAllLiquidations(lastBlock),
      fetchAllAlertEvents(lastBlock),
      fetchAllRevocations(lastBlock),
    ]);
  } catch (err) {
    console.error(JSON.stringify({ ts, event: 'scribe_fail', error: String(err) }));
    return;
  }

  const alerts: Alert[] = [];
  for (const ev of liquidationEvents) {
    alerts.push({
      kind: ALERT_KIND.liquidation_executed,
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
  for (const ev of alertEvents) {
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
  for (const ev of sigilRevocations) {
    alerts.push({
      kind: ALERT_KIND.mandate_revoked,
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
    if (!alert.user) {
      // System-wide alerts (usdc_paused, emergency_pause_invoked,
      // oracle_disagreement, vigil_queue_failed, link_balance_low,
      // adapter_emergency_deregistered) have no per-user recipient. Pre-fix
      // these were silently dropped at this `continue`. Now they are surfaced
      // to ops: logged at warn level (so they reach the log/Sentry pipeline)
      // and posted to NOTIFIER_OPS_WEBHOOK when configured.
      console.warn(JSON.stringify({ ts: new Date().toISOString(), event: 'system_alert', kind: alert.kind, severity: alert.severity, title: alert.title }));
      await deliverSystemAlert(alert);
      continue;
    }
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

/** Map subgraph AlertEvent.kind (lowercase) to notifier AlertKind */
function mapAlertKind(scribeKind: string): AlertKind | null {
  switch (scribeKind) {
    case ALERT_KIND.oracle_disagreement:            return ALERT_KIND.oracle_disagreement;
    case ALERT_KIND.vigil_queue_failed:             return ALERT_KIND.vigil_queue_failed;
    case ALERT_KIND.link_balance_low:               return ALERT_KIND.link_balance_low;
    case ALERT_KIND.usdc_paused:                    return ALERT_KIND.usdc_paused;
    case ALERT_KIND.adapter_emergency_deregistered: return ALERT_KIND.adapter_emergency_deregistered;
    case ALERT_KIND.emergency_pause_invoked:        return ALERT_KIND.emergency_pause_invoked;
    default: return null;
  }
}

function severityFor(kind: AlertKind): Alert['severity'] {
  if (kind === ALERT_KIND.usdc_paused || kind === ALERT_KIND.liquidation_executed || kind === ALERT_KIND.kill_switch_activated || kind === ALERT_KIND.emergency_pause_invoked) return 'critical';
  if (kind === ALERT_KIND.oracle_disagreement || kind === ALERT_KIND.vigil_queue_failed || kind === ALERT_KIND.link_balance_low || kind === ALERT_KIND.mandate_revoked) return 'warning';
  return 'info';
}

function humanTitle(kind: AlertKind): string {
  return kind.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Deliver a system-wide alert (no per-user recipient) to the operator ops
 * channel, configured via NOTIFIER_OPS_WEBHOOK. The URL is operator-supplied
 * (not user input), so no SSRF guard is needed. If unset, the warn-level log
 * in the tick loop is the record. Never throws into the tick.
 */
async function deliverSystemAlert(alert: Alert): Promise<void> {
  const url = process.env.NOTIFIER_OPS_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: alert.kind,
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        link: alert.link,
      }),
    });
  } catch (err) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: 'system_alert_delivery_fail', kind: alert.kind, error: String(err) }));
  }
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
