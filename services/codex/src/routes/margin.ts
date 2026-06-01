import { Hono } from 'hono';
import { gql } from '../lib/scribe';
import { safeErrorDetail } from '../lib/error-safe';

export const marginRouter = new Hono<{ Bindings: { SCRIBE_URL: string; ENV?: string } }>();

// Audit FFF-6 fix: same EEE-1 address-validation gap. Non-hex path params were
// passed straight to The Graph (which returns empty + 200, not 400), caller
// got ambiguous "exists: false" instead of "you sent garbage".
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

marginRouter.get('/account/:address', async (c) => {
  const addressRaw = c.req.param('address');
  if (!ADDRESS_REGEX.test(addressRaw)) {
    return c.json({ error: 'invalid_address', detail: 'address must be 0x-prefixed 40-hex' }, 400);
  }
  const address = addressRaw.toLowerCase();
  try {
    const data = await gql<{ marginAccount: any | null }>(c.env, `
      query MarginAccount($id: ID!) {
        marginAccount(id: $id) {
          id
          collateralValueWei
          requiredMarginWei
          marginVersion
          lastUpdateBlock
          isPaused
        }
      }
    `, { id: address });
    if (!data.marginAccount) {
      return c.json({ exists: false, address }, 404);
    }
    return c.json({ exists: true, account: data.marginAccount });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
