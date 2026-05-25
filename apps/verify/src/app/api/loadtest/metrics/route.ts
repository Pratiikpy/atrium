import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * GET /api/loadtest/metrics
 *
 * Serves the latest k6 + contract-gas measurements as the dashboard
 * payload shape that components/loadtest-dashboard.tsx expects:
 *   { name, unit, p50, p95, p99, budget, source }[]
 *
 * Reads from public/loadtest/latest.json (committed by the nightly
 * workflow at .github/workflows/loadtest-nightly.yml). If the file
 * exists with `metrics: []`, the dashboard renders the empty state -
 * honest until the first run completes.
 *
 * Phase zeta.7 (2026-05-25): wires the loadtest dashboard to a real
 * data source. Pre-fix the page surfaced 'starts Month 9' placeholder.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const filePath = path.resolve(process.cwd(), 'public', 'loadtest', 'latest.json');
  try {
    const text = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(text) as {
      generatedAt: string;
      metrics: Array<{ name: string; unit: string; p50: number; p95: number; p99: number; budget: number; source: string }>;
    };
    return NextResponse.json(parsed.metrics);
  } catch {
    return NextResponse.json([]);
  }
}
