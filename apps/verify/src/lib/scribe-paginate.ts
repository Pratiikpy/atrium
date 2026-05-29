/**
 * Cursor-based pagination helper for Scribe (The Graph) queries.
 *
 * Loops fetching pages of up to 1000 rows until the last page returns
 * fewer than 1000 rows (indicating exhaustion). Uses `id_gt` cursor
 * pattern per The Graph's recommended pagination approach.
 */

import { gql } from './scribe-helpers';

const PAGE_SIZE = 1000;

/**
 * Paginate a Scribe query until all rows are fetched.
 *
 * @param query - GraphQL query string. Must accept $first: Int! and $cursor: String!
 *               and use `where: { id_gt: $cursor }` + `first: $first` + `orderBy: id`.
 * @param parseRows - Extract the row array from the query response.
 * @param cursorOf - Extract the cursor (id) from the last row.
 */
export async function paginate<T, R>(
  query: string,
  parseRows: (data: T) => R[],
  cursorOf: (row: R) => string,
  variables?: Record<string, unknown>,
): Promise<R[]> {
  const all: R[] = [];
  let cursor = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<T>(query, { ...variables, first: PAGE_SIZE, cursor });
    const rows = parseRows(data);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    cursor = cursorOf(rows[rows.length - 1]);
  }

  return all;
}
