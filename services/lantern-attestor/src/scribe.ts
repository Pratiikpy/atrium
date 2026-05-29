/**
 * Scribe client for Lantern — user list only (Phase 6).
 *
 * Balance authority is now on-chain (leaves.ts does RPC fanout).
 * Scribe's role is 'list users to consider' only.
 */

export interface UserSalt {
  user: string;
  salt: string;
}

export async function fetchCofferUsers(opts: { scribeUrl: string }): Promise<UserSalt[]> {
  const PAGE_SIZE = 1000;
  const all: UserSalt[] = [];
  let cursor = '';

  while (true) {
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
