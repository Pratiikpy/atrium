import { Hono } from 'hono';
import { gql } from '../lib/scribe';
import { safeErrorDetail } from '../lib/error-safe';

export const riskRouter = new Hono<{ Bindings: { SCRIBE_URL: string; ENV?: string } }>();

// Audit FFF-7 fix: same EEE-1 address-validation gap. Heaviest endpoint by
// data volume — un-validated address means burning Scribe credit on each garbage
// call (max 100 positions returned per query in the worst-case).
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Risk snapshot: account + all open positions + the most-recent margin update.
 * Single GraphQL roundtrip. Heaviest endpoint by data volume; capped at 10rpm.
 */
riskRouter.get('/snapshot/:address', async (c) => {
  const addressRaw = c.req.param('address');
  if (!ADDRESS_REGEX.test(addressRaw)) {
    return c.json({ error: 'invalid_address', detail: 'address must be 0x-prefixed 40-hex' }, 400);
  }
  const address = addressRaw.toLowerCase();
  try {
    const data = await gql<{
      marginAccount: any | null;
      positions: any[];
      marginUpdates: any[];
    }>(c.env, `
      query Risk($id: ID!, $owner: ID!) {
        marginAccount(id: $id) {
          collateralValueWei
          requiredMarginWei
          marginVersion
          isPaused
        }
        positions(where: { owner: $owner, closedAtBlock: null }, first: 100) {
          venueId
          instrumentId
          notionalSigned
        }
        marginUpdates(where: { account: $owner }, orderBy: timestamp, orderDirection: desc, first: 1) {
          timestamp
          marginVersion
        }
      }
    `, { id: address, owner: address });
    return c.json({
      account: data.marginAccount,
      positions: data.positions,
      lastUpdate: data.marginUpdates[0] ?? null,
    });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});

/**
 * Audit Month-1 #160 — Codex endpoint 8 of 8 (PRD §17 Day-180 target).
 *
 * GET /v1/risk/correlations?ids=BTC-PERP,ETH-PERP,…
 *
 * Returns the correlation-class matrix Plinth uses for SPAN-style margin
 * netting. Pre-Phase-2 the matrix is loaded from a fixed JSON; the live
 * recomputation pipeline from Archive's historical-price feeds is a
 * Year-2 item.
 *
 * The shape matches `Plinth.set_correlation_classes` storage so the UI
 * can render the same numbers it pays margin on.
 */
riskRouter.get('/correlations', async (c) => {
  const idsRaw = c.req.query('ids') ?? '';
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return c.json({ error: 'no_instruments', detail: 'pass ids=A,B,C as a comma-separated list' }, 400);
  }
  if (ids.length > 16) {
    return c.json({ error: 'too_many', detail: 'max 16 instruments per call' }, 400);
  }
  // Each id must match the on-chain bytes32 keccak256 hex (no slashes).
  for (const id of ids) {
    if (!/^[A-Za-z0-9_\-]{1,32}$/.test(id)) {
      return c.json({ error: 'invalid_id', detail: `instrument id ${id} contains forbidden chars` }, 400);
    }
  }
  try {
    const data = await gql<{
      correlationClasses: Array<{ instrumentId: string; classId: string; haircutBps: number }>;
    }>(c.env, `
      query Corr($ids: [String!]!) {
        correlationClasses(where: { instrumentSlug_in: $ids }) {
          instrumentId
          classId
          haircutBps
        }
      }
    `, { ids });
    // Format: square matrix indexed by instrument id. Diagonal is 1.0 by
    // definition; off-diagonal is the haircut-derived correlation (1 -
    // haircut_bps/10000) when both belong to the same class, else 0.
    const byId = new Map(data.correlationClasses.map((c) => [c.instrumentId, c]));
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of ids) {
      matrix[a] = {};
      for (const b of ids) {
        if (a === b) { matrix[a][b] = 1.0; continue; }
        const ca = byId.get(a);
        const cb = byId.get(b);
        if (!ca || !cb || ca.classId !== cb.classId) {
          matrix[a][b] = 0;
        } else {
          matrix[a][b] = 1.0 - (ca.haircutBps / 10000);
        }
      }
    }
    return c.json({
      instruments: ids,
      matrix,
      source: 'on-chain Plinth.correlationClasses (Scribe-indexed)',
      note: 'Pre-Phase-2 correlation values are loaded from set_correlation_classes; live recomputation from Archive historical feeds is Year-2.',
    });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
