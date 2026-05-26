/**
 * Shared tick() — every agent has the same outer pipeline. Differences
 * live in the strategy function each agent passes in.
 *
 * Steps per cron firing:
 *   1. Probe Codex /health → if down, log and bail (no decisions on
 *      stale data per docs/conventions/security.md).
 *   2. Pull new mandates from Scribe (SigilValidation events).
 *   3. Run the agent-specific decision function (`strategy`).
 *   4. Record the tick into in-memory history for /api/status to expose.
 *
 * "Act on the decision" (i.e. submit an ActionSigil through Plinth
 * via Postern) is the production extension. For the buildathon cron
 * version we log the would-be decision; the user sees the loop alive
 * end-to-end in the agent /status panel without on-chain spam.
 */
import { codexHealth } from './codex.js';
import { recentMandatesForAgent, type SigilValidationView } from './scribe.js';
import { recordTick, type AgentTick } from './state.js';

interface TickEnv {
  scribeUrl: string;
  codexUrl: string;
  agentAddress: string;
}
interface StrategyArgs {
  mandates: SigilValidationView[];
  notes: string[];
}
type Strategy = (args: StrategyArgs) => Promise<void> | void;

export async function runTick(
  agentName: string,
  env: TickEnv,
  strategy: Strategy,
): Promise<AgentTick> {
  const startedAt = Date.now();
  const notes: string[] = [];
  let ok = true;

  // 1. Codex liveness probe.
  const health = await codexHealth(env.codexUrl);
  notes.push(`codex.health=${health.ok ? 'ok' : 'down'} (${health.latencyMs}ms)`);
  if (!health.ok) {
    notes.push('codex down — skipping decision per security rule');
    const tick: AgentTick = {
      agent: agentName,
      startedAt,
      durationMs: Date.now() - startedAt,
      ok: false,
      notes,
      tickCount: 0,
    };
    recordTick(tick);
    return tick;
  }

  // 2. New mandates since last tick.
  let mandates: SigilValidationView[] = [];
  try {
    mandates = await recentMandatesForAgent(env.scribeUrl, env.agentAddress);
    notes.push(`mandates.found=${mandates.length}`);
  } catch (err) {
    notes.push(`scribe.error=${err instanceof Error ? err.message : 'unknown'}`);
    ok = false;
  }

  // 3. Strategy.
  if (ok) {
    try {
      await strategy({ mandates, notes });
    } catch (err) {
      notes.push(`strategy.error=${err instanceof Error ? err.message : 'unknown'}`);
      ok = false;
    }
  }

  // 4. Record.
  const tick: AgentTick = {
    agent: agentName,
    startedAt,
    durationMs: Date.now() - startedAt,
    ok,
    notes,
    lastMandateId: mandates[0]?.id,
    tickCount: 0, // overwritten in recordTick
  };
  recordTick(tick);
  return tick;
}
