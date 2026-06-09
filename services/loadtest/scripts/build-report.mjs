/**
 * Combines summary.export.json (from k6) + gas-report.json (from
 * contract-gas.mjs) into the dashboard payload shape:
 *   { name, unit, p50, p95, p99, budget, source }[]
 *
 * Writes apps/verify/public/loadtest/latest.json.
 *
 * Usage:
 *   node scripts/build-report.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const OUT_PATH = resolve(REPO_ROOT, 'apps/verify/public/loadtest/latest.json');

async function tryReadJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const k6 = await tryReadJSON(resolve(__dirname, 'summary.export.json'));
  const gas = await tryReadJSON(resolve(__dirname, 'gas-report.json'));

  const metrics = [];

  if (k6?.endpoints) {
    for (const ep of k6.endpoints) {
      metrics.push({
        name: ep.path,
        unit: 'ms',
        p50: ep.p50 ?? 0,
        p95: ep.p95 ?? 0,
        p99: ep.p99 ?? 0,
        budget: 2000,
        source: 'k6 + useatrium.me',
      });
    }
  }

  if (gas?.targets) {
    for (const t of gas.targets) {
      if (t.gas == null) continue;
      metrics.push({
        name: t.fn,
        unit: 'gas',
        p50: t.gas,
        p95: t.gas,
        p99: t.gas,
        budget: t.budget_gas,
        source: 'viem.estimateContractGas',
      });
    }
  }

  if (metrics.length === 0) {
    console.warn('No metrics found in summary.export.json or gas-report.json. Writing empty payload.');
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        k6_base_url: k6?.baseUrl ?? null,
        metrics,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${OUT_PATH} (${metrics.length} metrics)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
