import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * GET /api/audit-findings
 *
 * Phase eta.16 (2026-05-25): parses docs/AUDIT_FINDINGS.md into JSON
 * so /security can render the audit findings register as a live table
 * (not a copy-paste that goes stale). The markdown remains the source
 * of truth; this route is a deserializer.
 *
 * Returns shape:
 *   {
 *     findings: Array<{ id: number; finding: string; agent: string;
 *                       location: string; owner: string; target: string;
 *                       status: 'closed' | 'pending'; statusDetail?: string }>;
 *     summary: { total: number; closed: number; pending: number };
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

function stripMd(s: string): string {
  return s.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

export async function GET() {
  const docPath = path.resolve(process.cwd(), '..', '..', 'docs', 'AUDIT_FINDINGS.md');
  let text: string;
  try {
    text = await readFile(docPath, 'utf8');
  } catch {
    // Vercel deploy may place the docs file at a different relative path
    // (project root); try the alternate.
    try {
      text = await readFile(path.resolve(process.cwd(), 'docs', 'AUDIT_FINDINGS.md'), 'utf8');
    } catch {
      return NextResponse.json({
        findings: [],
        summary: { total: 0, closed: 0, pending: 0 },
        source: 'pending',
        generatedAt: new Date().toISOString(),
      });
    }
  }

  // Parse the master register table rows. Format from docs/AUDIT_FINDINGS.md:
  //   | # | Finding | Agent | File / line | Owner | Target | Status |
  //   |---|---|---|---|---|---|---|
  //   | 1 | ... | A | path:line | F1 | This session |  (...detail...) |
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // Match a register row: starts with | <number> |
    const m = line.match(/^\|\s*(\d+)\s*\|(.+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const cells = m[2].split('|').map((c) => c.trim());
    if (cells.length < 6) continue;
    const [finding, agent, location, owner, target, statusRaw] = cells;
    const status: Finding['status'] = /✅|done|closed|patched|fixed/i.test(statusRaw)
      ? 'closed'
      : 'pending';
    const statusDetail = stripMd(statusRaw).replace(/^[✅🟡]+\s*/, '');
    findings.push({
      id,
      finding: stripMd(finding),
      agent: stripMd(agent),
      location: stripMd(location),
      owner: stripMd(owner),
      target: stripMd(target),
      status,
      statusDetail: statusDetail || undefined,
    });
  }

  const summary = {
    total: findings.length,
    closed: findings.filter((f) => f.status === 'closed').length,
    pending: findings.filter((f) => f.status === 'pending').length,
  };

  return NextResponse.json({
    findings,
    summary,
    source: 'docs' as const,
    generatedAt: new Date().toISOString(),
  });
}
