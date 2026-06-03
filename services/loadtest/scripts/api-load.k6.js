/**
 * k6 latency probe for the verify-app API surface.
 *
 * Three load tiers: 1, 10, 100 requests/second per endpoint, 60 s each.
 * Endpoints exercised:
 *   - /api/protocol/metrics       (subgraph + on-chain reads via /api/lantern/latest)
 *   - /api/protocol/subsystems    (live status of every contract)
 *   - /api/deployments/status     (Verifier step-readiness, including viem probes)
 *   - /api/faucet/status          (faucet stock + per-wallet cooldown)
 *
 * Output: k6 default summary + a `summary.export.json` that
 * services/loadtest/scripts/build-report.mjs ingests into the
 * dashboard payload at apps/verify/public/loadtest/latest.json.
 *
 * Usage:
 *   BASE_URL=https://verify.useatrium.me k6 run scripts/api-load.k6.js
 *   (or set BASE_URL=http://localhost:3000 for local dev runs)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://verify.useatrium.me';

const ENDPOINTS = [
  '/api/protocol/metrics',
  '/api/protocol/subsystems',
  '/api/deployments/status',
  '/api/faucet/status',
];

const TIERS = [
  { rps: 1, duration: '60s' },
  { rps: 10, duration: '60s' },
  { rps: 100, duration: '60s' },
];

// Per-endpoint trend tracking so the summary export shows p50/p95/p99
// for each route separately. k6 sums into one Trend if names collide.
const trends = {};
for (const ep of ENDPOINTS) {
  trends[ep] = new Trend(`latency_${ep.replace(/\//g, '_')}`, true);
}

export const options = {
  scenarios: Object.fromEntries(
    TIERS.flatMap((tier) =>
      ENDPOINTS.map((ep) => [
        `t${tier.rps}_${ep.replace(/\//g, '_')}`,
        {
          executor: 'constant-arrival-rate',
          rate: tier.rps,
          timeUnit: '1s',
          duration: tier.duration,
          preAllocatedVUs: Math.max(10, tier.rps * 2),
          maxVUs: Math.max(20, tier.rps * 5),
          env: { ENDPOINT: ep, TIER_RPS: String(tier.rps) },
          exec: 'hit',
          gracefulStop: '5s',
        },
      ])
    )
  ),
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 2 s p95 cap on the verify app
    'http_req_failed': ['rate<0.02'],    // <2% error rate
  },
};

export function hit() {
  const ep = __ENV.ENDPOINT;
  const url = `${BASE_URL}${ep}`;
  const res = http.get(url, { tags: { endpoint: ep, tier_rps: __ENV.TIER_RPS } });
  trends[ep].add(res.timings.duration);
  check(res, {
    '2xx or 404': (r) => r.status < 500,
  });
}

export function handleSummary(data) {
  // Compact summary.json for build-report.mjs to ingest.
  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    endpoints: ENDPOINTS.map((ep) => {
      const trend = data.metrics[`latency_${ep.replace(/\//g, '_')}`];
      return {
        path: ep,
        p50: trend?.values?.med ?? null,
        p95: trend?.values?.['p(95)'] ?? null,
        p99: trend?.values?.['p(99)'] ?? null,
        count: trend?.values?.count ?? 0,
      };
    }),
    thresholds: data.metrics.http_req_duration?.thresholds ?? {},
    error_rate: data.metrics.http_req_failed?.values?.rate ?? null,
  };
  return {
    stdout: JSON.stringify(out, null, 2),
    'summary.export.json': JSON.stringify(out, null, 2),
  };
}
