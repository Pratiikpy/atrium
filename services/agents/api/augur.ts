/**
 * Augur — volatility arbitrage agent.
 * Bollinger-band momentum strategy. TS port of the Rust crate at
 * agents/augur/. Runs on Vercel cron every 5 min.
 *
 * Address: deterministic per-deploy. For the buildathon we use a
 * fixed-per-instance address derived from AGENT_AUGUR_ADDRESS env;
 * production agents would each carry their own session key bound to
 * a registered Sigil mandate.
 */
import { runTick } from '../lib/tick.js';

export const config = { runtime: 'edge' };

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
    // Augur strategy stub. For mandates targeting this agent, the
    // production version would: fetch price band → compute signal →
    // build ActionSigil via session key → submit via AtriumRouter.
    // The buildathon scaffold logs the would-be action so the agent
    // is demonstrably alive without spamming on-chain txs.
    if (mandates.length > 0) {
      notes.push(`would-act-on: ${mandates.map((m) => m.intentHash).join(',')}`);
    } else {
      notes.push('no new mandates this window');
    }
  });

  return Response.json(tick);
}
