/**
 * Thin GraphQL client for Scribe (Atrium subgraph). Mirrors the
 * `scribe-helpers` lib in apps/verify so the cron agents see the
 * exact same indexed view a frontend user does.
 */

const TIMEOUT_MS = 8_000;

export async function scribeQuery<T>(
  scribeUrl: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const r = await fetch(scribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`scribe HTTP ${r.status}`);
  const body = (await r.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    throw new Error(`scribe errors: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  if (!body.data) throw new Error('scribe returned no data');
  return body.data;
}

export interface SigilValidationView {
  id: string;
  owner: string;
  agent: string;
  intentHash: string;
  blockNumber: string;
  timestamp: string;
  txHash: string;
}

/**
 * Pull recent SigilValidation events naming a specific agent. The agent
 * cron uses this to discover mandates it should act under. Field names
 * match subgraph/schema.graphql exactly (camelCase, not snake_case).
 */
export async function recentMandatesForAgent(
  scribeUrl: string,
  agentAddress: string,
  sinceBlock: number = 0,
): Promise<SigilValidationView[]> {
  const data = await scribeQuery<{ sigilValidations: SigilValidationView[] }>(
    scribeUrl,
    `query Recent($agent: Bytes!, $since: BigInt!) {
      sigilValidations(
        first: 25,
        where: { agent: $agent, blockNumber_gt: $since },
        orderBy: blockNumber,
        orderDirection: desc
      ) {
        id
        owner
        agent
        intentHash
        blockNumber
        timestamp
        txHash
      }
    }`,
    { agent: agentAddress.toLowerCase(), since: String(sinceBlock) },
  );
  return data.sigilValidations ?? [];
}
