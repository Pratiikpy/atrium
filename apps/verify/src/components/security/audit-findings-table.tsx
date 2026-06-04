'use client';

import { useQuery } from '@tanstack/react-query';

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

interface Response {
  findings: Finding[];
  summary: { total: number; closed: number; pending: number };
  source: 'docs' | 'pending';
  generatedAt: string;
}

async function fetchFindings(): Promise<Response> {
  const r = await fetch('/api/audit-findings');
  if (!r.ok) throw new Error('audit-findings_' + r.status);
  return r.json();
}

/**
 * Live audit findings register on /security. Source of truth is
 * docs/plan-tracker.md; the /api/audit-findings route deserializes
 * the markdown table into JSON. Phase eta.16.
 */
export function AuditFindingsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-findings'],
    queryFn: fetchFindings,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border border-divider bg-parchment p-6 text-center">
        <span className="inline-block h-4 w-32 animate-pulse rounded bg-divider/60" />
      </div>
    );
  }

  const findings = data?.findings ?? [];
  const summary = data?.summary;

  return (
    <div>
      {summary && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span className="text-ink">
            <strong className="font-mono">{summary.total}</strong> total findings
          </span>
          <span className="text-live">
            <strong className="font-mono">{summary.closed}</strong> closed
          </span>
          <span className={summary.pending > 0 ? 'text-testnet' : 'text-muted'}>
            <strong className="font-mono">{summary.pending}</strong> pending
          </span>
          <span className="text-muted">
            . source: <code className="font-mono">docs/plan-tracker.md</code>
          </span>
        </div>
      )}

      {findings.length === 0 && (
        <div className="rounded-md border border-divider bg-parchment p-6 text-center text-sm text-muted">
          Audit register pending or unavailable.
        </div>
      )}

      {findings.length > 0 && (
        <>
        <div className="grid min-w-0 max-w-full gap-3 sm:hidden">
          {findings.slice(0, 40).map((f) => (
            <article key={f.id} className="min-w-0 max-w-full overflow-hidden rounded-md border border-divider bg-parchment p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="font-mono text-[11px] text-muted">#{f.id}</p>
                <span
                  className={
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ' +
                    (f.status === 'closed'
                      ? 'bg-live-soft text-live'
                      : 'bg-testnet/10 text-testnet')
                  }
                >
                  <span
                    className={
                      'size-1.5 rounded-full ' +
                      (f.status === 'closed' ? 'bg-live' : 'bg-testnet')
                    }
                  />
                  {f.status}
                </span>
              </div>
              <p className="mt-2 min-w-0 break-words text-sm text-ink">{f.finding}</p>
              <p className="mt-3 min-w-0 break-all font-mono text-[11px] text-ink-soft">{f.location}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">{f.agent}</p>
            </article>
          ))}
          {findings.length > 40 && (
            <p className="rounded-md border border-divider bg-parchment-soft px-3 py-2 text-center text-[11px] text-muted">
              showing first 40 of {findings.length} . see{' '}
              <code className="font-mono">docs/plan-tracker.md</code> for the full register
            </p>
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-md border border-divider sm:block">
          <table className="min-w-full divide-y divide-divider text-[12.5px]">
            <thead className="bg-parchment-soft text-[10.5px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Finding</th>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider bg-parchment">
              {findings.slice(0, 40).map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="px-3 py-2.5 font-mono text-muted">{f.id}</td>
                  <td className="px-3 py-2.5 text-ink">{f.finding}</td>
                  <td className="px-3 py-2.5 font-mono text-muted">{f.agent}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-ink-soft">{f.location}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ' +
                        (f.status === 'closed'
                          ? 'bg-live-soft text-live'
                          : 'bg-testnet/10 text-testnet')
                      }
                    >
                      <span
                        className={
                          'size-1.5 rounded-full ' +
                          (f.status === 'closed' ? 'bg-live' : 'bg-testnet')
                        }
                      />
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {findings.length > 40 && (
            <p className="border-t border-divider bg-parchment-soft px-3 py-2 text-center text-[11px] text-muted">
              showing first 40 of {findings.length} . see{' '}
              <code className="font-mono">docs/plan-tracker.md</code> for the full register
            </p>
          )}
        </div>
        </>
      )}
    </div>
  );
}
