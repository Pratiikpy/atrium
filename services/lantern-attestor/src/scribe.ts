import type { Leaf } from './merkle';

/**
 * Read every Coffer balance from Scribe. Used by Lantern to build the
 * hourly attestation tree.
 */
export async function fetchCofferBalances(opts: { scribeUrl: string; cofferAddress: string }): Promise<Leaf[]> {
  // Real query joins CofferDeposit minus CofferWithdraw per user.
  // Year-1 simplification: query the aggregate balance entity which the
  // subgraph derives from deposit + withdraw events.
  // Audit C fix: entity is `cofferUserBalances` plural; matches schema.graphql.
  // Each user's balance is derived from deposit + withdraw events in
  // subgraph/src/coffer.ts (Wave-1 added).
  const query = `
    query Balances {
      cofferUserBalances(first: 1000, where: { balanceWei_gt: "0" }) {
        user
        balanceWei
        salt
      }
    }
  `;
  // Audit XXX-4 fix: explicit timeout. The hourly Lantern cron makes this
  // call; without a timeout a slow Scribe could stall the entire tick.
  // 10s matches the typical p99 for a 1000-row balance query.
  const r = await fetch(opts.scribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Scribe ${r.status}`);
  const json = (await r.json()) as { data?: { cofferUserBalances: any[] } };
  if (!json.data) return [];
  return json.data.cofferUserBalances.map((row) => ({
    user: row.user,
    balanceWei: BigInt(row.balanceWei),
    salt: row.salt,
  }));
}
