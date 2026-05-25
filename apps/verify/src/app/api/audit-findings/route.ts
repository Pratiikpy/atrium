import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * GET /api/audit-findings
 *
 * Phase eta.16 (2026-05-25): the audit-findings register is parsed from
 * docs/AUDIT_FINDINGS.md so /security can render it as a live table.
 *
 * Phase theta.2 (2026-05-25): pre-fix this route called fs.readFile on
 * `../../docs/AUDIT_FINDINGS.md` at request time. On Vercel the
 * serverless bundle does not package files outside the Next.js project
 * root, so every production request returned `findings: []` with
 * `source: 'pending'` — silently displaying "no audit findings".
 * Now we ship a pre-generated `public/audit-findings.json` (produced
 * by scripts/build-audit-findings.mjs at build time) and the route is
 * a thin deserializer over that file.
 *
 * Returns shape:
 *   {
 *     findings: Array<{ id; finding; agent; location; owner; target;
 *                       status: 'closed' | 'pending'; statusDetail? }>;
 *     summary: { total; closed; pending };
 *     source: 'docs' | 'pending';
 *     generatedAt: string;
 *   }
 */
export const dynamic = 'force-dynamic';

interface Finding {
  id: number;
  finding: string;
  agent: string;
  location: string;
  owner: string;
  target: string;
  status: 'closed' | 'pending';
  statusDetail?: string;
}

interface RegisterPayload {
  findings: Finding[];
  summary: { total: number; closed: number; pending: number };
  source: 'docs' | 'pending';
  generatedAt: string;
}

const EMPTY_PAYLOAD: RegisterPayload = {
  findings: [],
  summary: { total: 0, closed: 0, pending: 0 },
  source: 'pending',
  generatedAt: new Date(0).toISOString(),
};

export async function GET() {
  // Read the build-time JSON shipped at apps/verify/public/audit-findings.json.
  // Vercel packages everything under .next/ + the public/ contents into the
  // serverless bundle, so this path resolves both locally and in production.
  const candidatePaths = [
    path.resolve(process.cwd(), 'public', 'audit-findings.json'),
    path.resolve(process.cwd(), 'apps', 'verify', 'public', 'audit-findings.json'),
  ];

  for (const candidate of candidatePaths) {
    try {
      const text = await readFile(candidate, 'utf8');
      const payload = JSON.parse(text) as RegisterPayload;
      return NextResponse.json(payload);
    } catch {
      // Try the next candidate.
    }
  }

  // Build script never ran or the JSON is missing. Return honest pending.
  return NextResponse.json({
    ...EMPTY_PAYLOAD,
    generatedAt: new Date().toISOString(),
  });
}
