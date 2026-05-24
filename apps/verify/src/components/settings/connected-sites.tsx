'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Site { id: string; host: string; lastUsedAgo: string; }
interface Resp { sites: Site[]; source: 'postern' | 'pending'; }

async function fetchSites(): Promise<Resp> {
  try {
    const r = await fetch('/api/settings/connected-sites');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { sites: [], source: 'pending' };
  }
}

async function disconnect(host: string): Promise<{ ok: boolean }> {
  const r = await fetch(`/api/settings/connected-sites`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host }),
  });
  if (!r.ok) throw new Error(`disconnect_${r.status}`);
  return r.json();
}
async function revokeAll(): Promise<{ ok: boolean }> {
  const r = await fetch(`/api/settings/connected-sites?all=1`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`revoke_${r.status}`);
  return r.json();
}

export function ConnectedSitesCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['connected-sites'], queryFn: fetchSites, refetchInterval: 60_000 });
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const revokeMut = useMutation({
    mutationFn: revokeAll,
    onSettled: () => qc.invalidateQueries({ queryKey: ['connected-sites'] }),
  });
  const disconnectMut = useMutation({
    mutationFn: disconnect,
    onSettled: () => qc.invalidateQueries({ queryKey: ['connected-sites'] }),
  });

  return (
    <section className="rounded-md border border-divider bg-parchment p-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-display text-xl italic text-ink">Connected sites</p>
          <p className="mt-0.5 text-sm text-muted">Sites that have your wallet authorisation</p>
        </div>
        {data?.sites.length ? (
          confirmRevoke ? (
            <span className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setConfirmRevoke(false); revokeMut.mutate(); }}
                className="rounded-md bg-danger px-3 py-1.5 font-medium text-parchment hover:opacity-90"
              >
                Confirm revoke
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="rounded-md border border-divider px-3 py-1.5 text-ink hover:border-ink/30"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="rounded-md border border-divider px-3 py-1.5 text-xs text-ink hover:border-ink/30"
            >
              Revoke all
            </button>
          )
        ) : null}
      </header>

      {/* Audit R-5 fix: the API's session map is per-isolate today (real
          persistence lands when PosternKeyRegistry deploys). Until then a
          user could add a session, see it once, and lose it on the next
          isolate. Surface the caveat once. */}
      <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-ink-soft">
        <span className="font-medium text-warning">Heads up:</span> until Postern lands Month 1 W2, session state lives in the API's local memory and may reset on cold starts. Real on-chain revocation runs through PosternKeyRegistry.
      </p>

      {!data?.sites.length ? (
        <p className="mt-4 text-sm text-muted">No active sessions. Connect Atrium from an app to see it here.</p>
      ) : (
        <ul className="mt-4 divide-y divide-divider-soft">
          {data.sites.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between py-3 text-sm">
              <span className="font-mono text-ink">{s.host}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{s.lastUsedAgo}</span>
                <button
                  type="button"
                  onClick={() => disconnectMut.mutate(s.host)}
                  disabled={disconnectMut.isPending}
                  className="rounded-md border border-divider px-2.5 py-1 text-[11px] text-ink hover:border-ink/30 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
