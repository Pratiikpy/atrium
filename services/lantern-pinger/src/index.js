/**
 * Lantern PoR pinger. Fires a GitHub workflow_dispatch for lantern-cron.yml on
 * a Cloudflare cron trigger, replacing GitHub's throttled scheduler as the
 * restart signal for the attestation publish loop. See wrangler.toml for why.
 */

async function dispatch(env) {
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${env.GH_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'atrium-lantern-pinger',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: env.GH_REF }),
  });
  // 204 = dispatched. Anything else is logged loudly so Workers observability
  // surfaces it; the next cron tick retries, so a transient failure self-heals.
  if (res.status !== 204) {
    const body = await res.text();
    console.error(`lantern-pinger dispatch failed: ${res.status} ${body.slice(0, 200)}`);
    return { ok: false, status: res.status };
  }
  console.log('lantern-pinger: workflow_dispatch ok');
  return { ok: true, status: 204 };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env));
  },
  // Manual verification path: POST /ping with X-Ping-Key. Lets ops confirm the
  // whole chain (worker -> GitHub -> workflow run) without waiting for a tick.
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/ping') {
      if (req.headers.get('x-ping-key') !== env.PING_KEY) {
        return new Response('forbidden', { status: 403 });
      }
      const r = await dispatch(env);
      return Response.json(r, { status: r.ok ? 200 : 502 });
    }
    return new Response('atrium-lantern-pinger', { status: 200 });
  },
};
