/**
 * Augur, volatility arbitrage agent.
 * Bollinger-band momentum strategy. TS port of the Rust crate at
 * agents/augur/. Runs on Vercel cron every 5 min.
 *
 * Address: deterministic per-deploy. For the buildathon we use a
 * fixed-per-instance address derived from AGENT_AUGUR_ADDRESS env;
 * production agents would each carry their own session key bound to
 * a registered Sigil mandate.
 */
import { runTick } from '../lib/tick.js';
import { loadMandate, actOnMandate } from '../lib/act.js';

export const config = { runtime: 'edge' };

// Bounds repeated opens within one warm instance: the on-chain mandate caps
// (max_actions_per_24h, max_total_open_notional) are the hard backstop, but
// this avoids broadcasting a guaranteed-revert every tick once we have acted.
let actedThisInstance = false;
// Augur's demo action size: a small, in-cap notional (2 USDC, 1e6 scale).
const AUGUR_DEMO_NOTIONAL = 2_000_000n;

export default async function handler(req: Request): Promise<Response> {
  // Cron-only auth (Vercel injects Authorization: Bearer <CRON_SECRET>).
  const expected = process.env.CRON_SECRET;
  if (!expected) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tick = await runTick('augur', {
    scribeUrl: process.env.SCRIBE_URL ?? '',
    codexUrl: process.env.CODEX_URL ?? '',
    agentAddress: process.env.AGENT_AUGUR_ADDRESS
      ?? '0x0000000000000000000000000000000000000000',
  }, async ({ mandates, notes }) => {
    if (mandates.length === 0) {
      notes.push('no new mandates this window');
      return;
    }

    // Real-action path: when a session key + a user-signed mandate envelope are
    // configured AND the operator has armed the agent, build + agent-sign an
    // ActionSigil and submit it through the Router. Absent any of these, the
    // agent stays the honest "would-act-on" log (never a fabricated trade).
    const mandate = loadMandate('AGENT_AUGUR');
    const armed = process.env.AGENT_AUGUR_ARMED === 'true';
    const liveMatch = mandate ? mandates.some((m) => m.intentHash.toLowerCase() === mandate.intent_hash.toLowerCase()) : false;

    if (mandate && armed && liveMatch && !actedThisInstance) {
      try {
        const res = await actOnMandate('AGENT_AUGUR', mandate, AUGUR_DEMO_NOTIONAL, BigInt(Math.floor(Date.now() / 1000)));
        actedThisInstance = true; // bound to one attempt per warm instance
        if (res.acted) {
          notes.push(`acted: opened ${res.notionalWei} on intent ${mandate.intent_hash.slice(0, 10)} tx=${res.txHash}`);
        } else {
          // A revert here is the enforcement working (cap / instrument gate), not a bug.
          notes.push(`action-blocked: ${res.reason}${res.txHash ? ` tx=${res.txHash}` : ''}`);
        }
      } catch (err) {
        notes.push(`action-error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
      return;
    }

    // Honest stub: the loop is alive and sees the mandate, but is not configured
    // / armed to act yet. (mandate configured? ${mandate ? 'y' : 'n'}, armed? ${armed ? 'y' : 'n'})
    notes.push(`would-act-on: ${mandates.map((m) => m.intentHash).join(',')}`);
  });

  return Response.json(tick);
}
