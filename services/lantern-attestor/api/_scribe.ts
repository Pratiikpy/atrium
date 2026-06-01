/**
 * Scribe client for Lantern (Vercel api/ path) — user list only.
 *
 * Mirrors src/scribe.ts. Balance authority is on-chain (see _leaves.ts,
 * which reads convertToAssets(balanceOf(user))); Scribe only lists which
 * users to consider.
 *
 * P0-3 fix: this previously issued a single `cofferUserBalances(first: 1000)`
 * query and used the subgraph's raw `balanceWei` (net deposits) as the leaf
 * balance. Two bugs: (1) >1000 users were silently dropped from the
 * proof-of-reserves tree; (2) net deposits != redeemable value, so roots
 * were wrong. Now paginates by `id_gt` cursor and returns user+salt only —
 * _leaves.ts computes the redeemable balance on-chain.
 */
export interface UserSalt {
  user: string;
  salt: string;
}

export async function fetchCofferUsers(opts: { scribeUrl: string }): Promise<UserSalt[]> {
  const PAGE_SIZE = 1000;
  const all: UserSalt[] = [];
  let cursor = '';

  for (;;) {
    const query = `
      query Users($first: Int!, $cursor: String!) {
        cofferUserBalances(first: $first, where: { balanceWei_gt: "0", id_gt: $cursor }, orderBy: id) {
          id
          user
          salt
        }
      }
    `;
    const r = await fetch(opts.scribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { first: PAGE_SIZE, cursor } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`Scribe ${r.status}`);
    const json = (await r.json()) as {
      data?: { cofferUserBalances: Array<{ id: string; user: string; salt: string }> };
    };
    const rows = json.data?.cofferUserBalances ?? [];
    for (const row of rows) {
      all.push({ user: row.user, salt: row.salt });
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }

  return all;
}
