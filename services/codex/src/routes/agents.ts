import { Hono } from 'hono';
import { gql } from '../lib/scribe';
// Audit U-30 fix: pre-fix this file referenced `safeErrorDetail` on lines
// 39, 73, 178 (all catch blocks for Scribe errors) without importing it.
// At runtime any Scribe outage on any of three endpoints would throw
// `ReferenceError: safeErrorDetail is not defined`, the route's honest-
// 503 fallback path silently became a 500. The other Codex routes
// (risk.ts, venues.ts, attestation.ts, positions.ts, options.ts, etc.)
// all import this helper; agents.ts was the lone gap.
import { safeErrorDetail } from '../lib/error-safe';

export const agentsRouter = new Hono<{
  Bindings: {
    SCRIBE_URL: string;
    ENV?: string;
    // Agent EOAs are Worker env bindings, not Node process env. Codex runs
    // on Cloudflare Workers where `process` is undefined at runtime, so these
    // must come off `c.env` (set in wrangler.toml / dashboard vars).
    AUGUR_ADDRESS?: string;
    HARUSPEX_ADDRESS?: string;
    AUSPEX_ADDRESS?: string;
  };
}>();

// Audit EEE-1/2/3 fix: every user-controlled parameter that flows into a gql
// query must be validated. Pre-fix, malformed cursors / since-timestamps /
// addresses were passed straight through, causing The Graph to either 400
// or silently coerce, neither honest nor defensive.
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
function parseUintOrNull(s: string | undefined): string | null {
  if (s == null || !/^\d+$/.test(s)) return null;
  return s;
}

agentsRouter.get('/leaderboard', async (c) => {
  const sinceRaw = c.req.query('since');
  // Audit EEE-2: `since` is a BigInt query var. Strict-numeric or default '0'.
  const since = parseUintOrNull(sinceRaw) ?? '0';
  try {
    const data = await gql<{ agents: any[] }>(c.env, `
      query Leaderboard($since: BigInt) {
        agents(
          first: 100,
          orderBy: totalPnlSigned,
          orderDirection: desc,
          where: { totalActionsCount_gte: 10, lastActionTimestamp_gte: $since }
        ) {
          id
          totalActionsCount
          totalPnlSigned
          reputationScore
          lastActionTimestamp
        }
      }
    `, { since });
    return c.json({ agents: data.agents, count: data.agents.length });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});

agentsRouter.get('/:address/history', async (c) => {
  // Audit EEE-1: validate the address shape before lowercasing + querying.
  // A non-hex path param would otherwise pass straight to The Graph with
  // empty results, wasted query + ambiguous error to the caller.
  const addressRaw = c.req.param('address');
  if (!ADDRESS_REGEX.test(addressRaw)) {
    return c.json({ error: 'invalid_address', detail: 'address must be 0x-prefixed 40-hex' }, 400);
  }
  const address = addressRaw.toLowerCase();
  // Audit EEE-3: strict-numeric cursor or 0. parseInt(NaN) → NaN → "skip: NaN"
  // would hit The Graph as a malformed Int value.
  const cursorRaw = c.req.query('cursor');
  const cursor = parseUintOrNull(cursorRaw);
  const skip = cursor != null ? parseInt(cursor, 10) : 0;
  try {
    const data = await gql<{ positions: any[] }>(c.env, `
      query AgentHistory($owner: ID!, $skip: Int) {
        positions(where: { owner: $owner }, orderBy: openedAtTimestamp, orderDirection: desc, first: 50, skip: $skip) {
          id
          venueId
          instrumentId
          notionalSigned
          openedAtTimestamp
          closedAtTimestamp
          realizedPnlSigned
        }
      }
    `, { owner: address, skip });
    return c.json({ history: data.positions });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});

/**
 * Audit Month-1 #160, Codex endpoint expansion.
 *
 * POST /v1/agents/intent-validation
 *
 * Body: { agent, owner, instrumentId, notionalSigned, intentHash }
 *
 * Read-only pre-flight check against Sigil's on-chain mandate state:
 *   1. Is `intentHash` already revoked? (Sigil.revoked_intents)
 *   2. Has `agent` exceeded `open_notional_wei` cap for this `owner`?
 *      (Sigil.open_notional_wei, indexed by Scribe)
 *   3. Has the per-action cap `max_per_action_notional_wei` already been hit
 *      this round? (Sigil intent state)
 *
 * Returns the failure reason if any check fails. Agents call this before
 * submitting an on-chain `validate_action` to avoid burning gas on a
 * doomed call. The on-chain Sigil contract is the ultimate authority -
 * this endpoint is a hint, not a guarantee.
 */
agentsRouter.post('/intent-validation', async (c) => {
  type Body = {
    agent: string;
    owner: string;
    instrumentId: string;
    notionalSigned: string;
    intentHash: string;
  };
  let body: Body;
  try {
    body = await c.req.json<Body>();
  } catch {
    return c.json({ error: 'bad_json' }, 400);
  }
  // Audit EEE-1 pattern: validate every input. Bad input here would lead
  // to wasted Scribe credits + ambiguous client-side errors.
  if (!ADDRESS_REGEX.test(body.agent ?? '') || !ADDRESS_REGEX.test(body.owner ?? '')) {
    return c.json({ error: 'invalid_address', detail: 'agent and owner must be 0x-prefixed 40-hex' }, 400);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(body.intentHash ?? '')) {
    return c.json({ error: 'invalid_intent_hash', detail: 'must be 0x-prefixed 64-hex' }, 400);
  }
  if (!/^-?\d+$/.test(body.notionalSigned ?? '')) {
    return c.json({ error: 'invalid_notional', detail: 'must be a decimal integer string' }, 400);
  }

  const agent = body.agent.toLowerCase();
  const owner = body.owner.toLowerCase();
  const requestedAbs = BigInt(body.notionalSigned.replace('-', ''));

  try {
    const data = await gql<{
      sigilMandate: any | null;
      sigilRevocation: any | null;
    }>(c.env, `
      query Intent($mandateId: ID!, $revId: ID!) {
        sigilMandate(id: $mandateId) {
          maxTotalOpenNotionalWei
          maxPerActionNotionalWei
          openNotionalWei
          expiresAt
          isPaused
        }
        sigilRevocation(id: $revId) {
          revokedAtBlock
        }
      }
    `, {
      mandateId: `${owner}-${agent}`.toLowerCase(),
      revId: body.intentHash.toLowerCase(),
    });

    if (data.sigilRevocation) {
      return c.json({ valid: false, reason: 'intent_revoked', details: data.sigilRevocation });
    }
    const m = data.sigilMandate;
    if (!m) {
      return c.json({ valid: false, reason: 'mandate_not_found' });
    }
    if (m.isPaused) {
      return c.json({ valid: false, reason: 'mandate_paused' });
    }
    const now = Math.floor(Date.now() / 1000);
    if (Number(m.expiresAt) <= now) {
      return c.json({ valid: false, reason: 'mandate_expired', expiresAt: m.expiresAt });
    }
    if (requestedAbs > BigInt(m.maxPerActionNotionalWei)) {
      return c.json({ valid: false, reason: 'exceeds_per_action_cap', cap: m.maxPerActionNotionalWei });
    }
    const projected = BigInt(m.openNotionalWei) + requestedAbs;
    if (projected > BigInt(m.maxTotalOpenNotionalWei)) {
      return c.json({
        valid: false,
        reason: 'would_exceed_total_open_cap',
        currentOpen: m.openNotionalWei,
        cap: m.maxTotalOpenNotionalWei,
        requested: body.notionalSigned,
      });
    }

    return c.json({ valid: true, mandateState: m });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});



/**
 * Phase 6 (FULL_AUDIT #50): Real agent status from Scribe.
 * Returns lastAction timestamp, totalActions count, currentMandateAddress.
 */
agentsRouter.get('/status/:agentName', async (c) => {
  const agentName = c.req.param('agentName');
  const KNOWN_AGENTS: Record<string, string> = {
    augur: (c.env.AUGUR_ADDRESS ?? '').toLowerCase(),
    haruspex: (c.env.HARUSPEX_ADDRESS ?? '').toLowerCase(),
    auspex: (c.env.AUSPEX_ADDRESS ?? '').toLowerCase(),
  };
  const agentAddr = KNOWN_AGENTS[agentName];
  if (!agentAddr || !ADDRESS_REGEX.test(agentAddr)) {
    return c.json({ error: 'unknown_agent', detail: `agent "${agentName}" not configured` }, 404);
  }
  try {
    const data = await gql<{
      agentActions: Array<{ timestamp: string }>;
      agent: { totalActionsCount: string; mandateAddress: string } | null;
    }>(c.env, `
      query AgentStatus($addr: ID!) {
        agentActions(where: { agent: $addr }, first: 1, orderBy: timestamp, orderDirection: desc) {
          timestamp
        }
        agent(id: $addr) {
          totalActionsCount
          mandateAddress
        }
      }
    `, { addr: agentAddr });

    const lastAction = data.agentActions?.[0]?.timestamp
      ? new Date(Number(data.agentActions[0].timestamp) * 1000).toISOString()
      : null;
    return c.json({
      agent: agentName,
      address: agentAddr,
      lastAction,
      totalActions: data.agent?.totalActionsCount ? Number(data.agent.totalActionsCount) : 0,
      currentMandateAddress: data.agent?.mandateAddress ?? null,
    });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
