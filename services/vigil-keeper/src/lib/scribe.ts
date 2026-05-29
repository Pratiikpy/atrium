/**
 * Narrow Scribe (subgraph) client for vigil-keeper. Mirrors the shape used
 * by services/agents/lib/scribe.ts so the GHA cron pattern stays uniform.
 */

export interface PausedMarginAccount {
  id: string;          // user address (lowercase hex)
  user: string;
  marginVersion: string;
  isPaused: boolean;
  lastUpdateBlock: string;
}

export interface ScribeError extends Error {
  status?: number;
  body?: string;
}

const QUERY_PAUSED = /* GraphQL */ `
  query PausedAccounts {
    marginAccounts(where: { isPaused: true }, first: 50, orderBy: lastUpdateBlock, orderDirection: desc) {
      id
      user
      marginVersion
      isPaused
      lastUpdateBlock
    }
  }
`;

export async function fetchPausedAccounts(scribeUrl: string): Promise<PausedMarginAccount[]> {
  const res = await fetch(scribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY_PAUSED }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = new Error(`Scribe responded ${res.status}`) as ScribeError;
    err.status = res.status;
    err.body = await res.text().catch(() => '');
    throw err;
  }
  const json = (await res.json()) as {
    data?: { marginAccounts: PausedMarginAccount[] };
    errors?: Array<{ message: string }>;
  };
  if (json.errors) {
    throw new Error(`Scribe GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data?.marginAccounts ?? [];
}
