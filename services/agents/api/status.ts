/**
 * Public status endpoint, no auth required.
 * Returns the last tick of each agent so the verify-app can render
 * "agents are alive" badges in the /app/agents panel.
 */
import { getAllAgents, getHistory } from '../lib/state.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const detail = url.searchParams.get('detail');
  if (detail === 'history') {
    return Response.json({
      augur: getHistory('augur'),
      haruspex: getHistory('haruspex'),
      auspex: getHistory('auspex'),
    });
  }
  // Default: summary
  const agents = getAllAgents();
  // If no agent has ever ticked this instance (cold start), return
  // honest pending instead of an empty array dressed as success.
  if (agents.length === 0) {
    return Response.json({
      status: 'pending',
      detail: 'no ticks recorded on this instance yet, cron fires every 5 min',
      agents: [
        { agent: 'augur', last: null, count: 0 },
        { agent: 'haruspex', last: null, count: 0 },
        { agent: 'auspex', last: null, count: 0 },
      ],
    });
  }
  return Response.json({ status: 'live', agents });
}
