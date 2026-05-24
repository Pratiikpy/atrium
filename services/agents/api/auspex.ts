/**
 * Auspex — funding-carry agent. TS port of agents/auspex/. Watches
 * Hyperliquid HIP-3 funding rates, takes the funded side of high-
 * conviction divergences.
 */
import { runTick } from '../lib/tick.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tick = await runTick('auspex', {
    scribeUrl: process.env.SCRIBE_URL ?? '',
    codexUrl: process.env.CODEX_URL ?? '',
    agentAddress: process.env.AGENT_AUSPEX_ADDRESS
      ?? '0x0000000000000000000000000000000000000000',
  }, async ({ mandates, notes }) => {
    if (mandates.length > 0) {
      notes.push(`funding-divergence-eval: ${mandates.length} mandate(s)`);
    } else {
      notes.push('no funding divergence triggers');
    }
  });

  return Response.json(tick);
}
