/**
 * Per-agent state, recorded across cron invocations.
 *
 * Vercel serverless functions have no persistent local FS, but each
 * cron invocation is independent: state must live somewhere that
 * survives between ticks. Options considered:
 *
 *   1. **In-memory** (this file). State is per-Edge-worker-instance.
 *      Cold starts reset it. For demo purposes (count of ticks, last
 *      seen mandate) this is fine, the user reads it via /api/status
 *      and what they see is "this instance has done N ticks since
 *      last cold start", which is honest.
 *   2. **Upstash Redis**, adds a signup. Skip for testnet.
 *   3. **On-chain Edict events**, emit a tick event from a fixed
 *      relayer wallet. Most expensive but most demoable. Future.
 *
 * If/when persistence matters (e.g. dedup across cold-starts to avoid
 * acting on the same mandate twice), upgrade to (2) or (3).
 */

export interface AgentTick {
  agent: string;
  startedAt: number;
  durationMs: number;
  ok: boolean;
  notes: string[];
  // Last mandate id seen, used to skip already-acted-on intents on the
  // next tick. Best-effort only (resets on cold start).
  lastMandateId?: string;
  // Counter increments every successful tick.
  tickCount: number;
}

// Per-agent rolling window of last 20 ticks. In-memory; per-instance.
const HISTORY = new Map<string, AgentTick[]>();
const MAX_HISTORY = 20;

export function recordTick(tick: AgentTick): void {
  const prev = HISTORY.get(tick.agent) ?? [];
  const tickCount = (prev[0]?.tickCount ?? 0) + 1;
  const enriched = { ...tick, tickCount };
  const updated = [enriched, ...prev].slice(0, MAX_HISTORY);
  HISTORY.set(tick.agent, updated);
}

export function getHistory(agent: string): AgentTick[] {
  return HISTORY.get(agent) ?? [];
}

export function getAllAgents(): { agent: string; last: AgentTick | null; count: number }[] {
  return Array.from(HISTORY.entries()).map(([agent, ticks]) => ({
    agent,
    last: ticks[0] ?? null,
    count: ticks[0]?.tickCount ?? 0,
  }));
}
