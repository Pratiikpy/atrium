import { Hono } from 'hono';
import { gql } from '../lib/scribe';
import { safeErrorDetail } from '../lib/error-safe';

export const attestationRouter = new Hono<{
  Bindings: { SCRIBE_URL: string; ENV?: string; IPFS_GATEWAY?: string };
}>();

/**
 * Codex's research-attestation gateway. Returns the latest on-chain
 * ResearchAttestation row + a caveat field directing consumers to verify
 * the IPFS-side honesty flag themselves.
 *
 * Codex doesn't fetch IPFS server-side because CF Workers have tight
 * latency budgets and the IPFS gateway is the slow path. The verify-app
 * does its own server-side fetch (Next.js has `next.revalidate` caching);
 * Codex's agent + third-party consumers are expected to do the same.
 *
 * The `caveat.is_publishable_check` field names the gate explicitly. A
 * consumer that ignores it is making an active choice — same shape as
 * the `--json-path` opt-out warning in praetor-cli backtest publish.
 */
attestationRouter.get('/latest', async (c) => {
  try {
    const data = await gql<{ backtestAttestations: any[] }>(c.env, `
      query Latest {
        backtestAttestations(first: 1, orderBy: timestampSeconds, orderDirection: desc) {
          id
          ipfsHash
          tradesCount
          collateralDeltaBps
          timestampSeconds
          notebookUrl
          blockNumber
        }
      }
    `);
    const attestation = data.backtestAttestations[0] ?? null;
    if (!attestation) {
      return c.json({ attestation: null, reason: 'no_attestation_yet' });
    }
    // Iteration 33 audit fix: agents + third-party integrators calling
    // Codex were getting raw on-chain fields with no signal that the
    // numbers might be from a synthetic-pairs backtest. The on-chain
    // contract doesn't carry is_publishable (it lives in the IPFS-pinned
    // JSON); Codex surfaces a caveat that names the gate so consumers
    // know to do the check.
    const gateway = c.env.IPFS_GATEWAY ?? 'https://ipfs.io';
    return c.json({
      attestation,
      caveat: {
        is_publishable_check:
          'On-chain numbers do not carry the honesty flag. Fetch the IPFS JSON ' +
          'behind `attestation.ipfsHash` and verify `is_publishable === true` ' +
          'before treating average_saving_bps as a real backtest result. See ' +
          'services/archive/src/span_backtest.py docstring + iteration-28 audit ' +
          'fix for the full chain.',
        ipfs_url: `${gateway}/ipfs/${attestation.ipfsHash}`,
        schema_version_required: 2,
        publishable_required: true,
      },
    });
  } catch (err) {
    return c.json({ error: 'scribe_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
