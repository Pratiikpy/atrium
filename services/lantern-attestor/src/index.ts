/**
 * Lantern, Atrium proof-of-reserves attestor.
 *
 * Cron-driven (hourly). Reads all Coffer balances from Scribe, builds a sparse
 * Merkle tree, signs the root with the Argon2id-encrypted software key, and
 * publishes via LanternAttestor.publish(root, block, signature).
 *
 * Per TDD §8.3 + §13.3. No cloud HSM (violated Tenet 5); software key with
 * Shamir 3-of-5 backup instead.
 *
 * This file is the LONG-RUNNING entrypoint for non-serverless hosts (Fly,
 * $5 VPS, local dev). The publish cycle itself lives in `publish-once.ts`
 * so it can also be imported by a Vercel cron handler (api/cron.ts) without
 * pulling in this module's while-loop.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { publishOnce } from './publish-once';

const HOUR_MS = 60 * 60 * 1000;

async function main() {
  while (true) {
    try {
      await publishOnce();
    } catch (err) {
      console.error('[lantern] tick failed', err);
    }
    await sleep(HOUR_MS);
  }
}

main().catch((err) => {
  console.error('[lantern] fatal', err);
  process.exit(1);
});
