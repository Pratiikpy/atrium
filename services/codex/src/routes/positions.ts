import { Hono } from 'hono';
import { gql } from '../lib/scribe';
import { safeErrorDetail } from '../lib/error-safe';

export const positionsRouter = new Hono<{ Bindings: { SCRIBE_URL: string; ENV?: string } }>();

// Audit EEE-1/3 fix: same input-validation gaps as agents.ts. Address must be
// 0x-prefixed 40-hex; cursor must be strict-numeric or null.
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
function parseUintOrNull(s: string | undefined): string | null {
  if (s == null || !/^\d+$/.test(s)) return null;
  return s;
}

positionsRouter.get('/:address', async (c) => {
  const addressRaw = c.req.param('address');
  if (!ADDRESS_REGEX.test(addressRaw)) {
    return c.json({ error: 'invalid_address', detail: 'address must be 0x-prefixed 40-hex' }, 400);
  }
  const address = addressRaw.toLowerCase();
  const cursorRaw = c.req.query('cursor');
  const cursor = parseUintOrNull(cursorRaw);
  const skip = cursor != null ? parseInt(cursor, 10) : 0;
  try {
    const data = await gql<{ positions: any[] }>(c.env, `
      query Positions($owner: ID!, $skip: Int) {
        positions(where: { owner: $owner, closedAtBlock: null }, first: 100, skip: $skip,
                  orderBy: openedAtBlock, orderDirection: desc) {
          id
          venueId
          instrumentId
          notionalSigned
          entryPriceQ64
          openedAtBlock
          openedAtTimestamp
        }
      }
    `, { owner: address, skip });
    return c.json({ positions: data.positions, count: data.positions.length });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});

/**
 * Audit Month-1 #160 — Codex endpoint expansion.
 *
 * GET /v1/positions/aggregated/:address
 *
 * Single roll-up of all open positions for an account, grouped by venue
 * and by instrument. Saves the UI from making 100 single-position calls
 * to build a portfolio summary view.
 */
positionsRouter.get('/aggregated/:address', async (c) => {
  const addressRaw = c.req.param('address');
  if (!ADDRESS_REGEX.test(addressRaw)) {
    return c.json({ error: 'invalid_address', detail: 'address must be 0x-prefixed 40-hex' }, 400);
  }
  const address = addressRaw.toLowerCase();
  try {
    const data = await gql<{ positions: any[] }>(c.env, `
      query AggPositions($owner: ID!) {
        positions(where: { owner: $owner, closedAtBlock: null }, first: 200) {
          venueId
          instrumentId
          notionalSigned
        }
      }
    `, { owner: address });

    // Bucket by venue and by instrument. notionalSigned is a string from the
    // subgraph (BigInt-as-string); sum via BigInt to avoid precision loss.
    const byVenue: Record<string, bigint> = {};
    const byInstrument: Record<string, bigint> = {};
    let totalAbsNotional = 0n;
    for (const p of data.positions) {
      const ns = BigInt(p.notionalSigned);
      const abs = ns < 0n ? -ns : ns;
      totalAbsNotional += abs;
      byVenue[p.venueId] = (byVenue[p.venueId] ?? 0n) + ns;
      byInstrument[p.instrumentId] = (byInstrument[p.instrumentId] ?? 0n) + ns;
    }
    // Convert BigInts to strings for JSON.
    const toStr = (rec: Record<string, bigint>) =>
      Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.toString()]));
    return c.json({
      address,
      openPositions: data.positions.length,
      totalAbsNotional: totalAbsNotional.toString(),
      byVenue: toStr(byVenue),
      byInstrument: toStr(byInstrument),
    });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
