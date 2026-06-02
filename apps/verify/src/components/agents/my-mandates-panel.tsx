'use client';

import { useEffect, useState } from 'react';
import type { Mandate } from '@/app/api/agents/my-mandates/route';
import { Modal, ModalCloseButton } from '@/components/ui/modal';
import { useRevokeMandate } from '@/lib/use-revoke-mandate';
import { useScopedWallet, walletQuery } from '@/lib/use-scoped-wallet';

/**
 * My mandates tab, lists active Sigils issued by the connected wallet.
 *
 * Reads `/api/agents/my-mandates` which queries Scribe for SigilValidation
 * minus SigilRevocation. Empty list with `source: 'pending'` renders the
 * named "no wallet"/"scribe unavailable" reason, never silently empty.
 *
 * Each row shows agent address, issuance time, intent-hash short form,
 * an Arbiscan link to the validation tx, AND a Revoke button that fires
 * Sigil.revoke(intentHash) after a confirmation dialog. When Sigil is
 * not deployed yet, the button is disabled with the standard honest
 * blocker. Spec: ATRIUM_FULL_FLOW_DESIGN.md "Revoking a single mandate".
 */

type ApiShape = {
  mandates: Mandate[];
  source: 'scribe' | 'pending';
  reason?: string;
};

export function MyMandatesPanel() {
  const wallet = useScopedWallet();
  const [data, setData] = useState<ApiShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // No wallet -> render the honest "connect a wallet" state directly; never
    // fetch a wallet-scoped endpoint that 401s. Interactive-sweep 2026-06-02
    // caught a hard crash here: the disconnected fetch 401'd, r.json() returned
    // an error object with NO `mandates` array, and data.mandates.length threw
    // TypeError on a public app page. Scope the fetch + guard non-ok responses.
    if (!wallet) {
      setError(null);
      setData({ mandates: [], source: 'pending', reason: 'no_wallet_configured' });
      return;
    }
    // Phase theta audit follow-up: scope to the connected wallet.
    fetch(walletQuery('/api/agents/my-mandates', wallet))
      .then(async (r) => {
        if (!r.ok) {
          // 401/5xx body is an error object, not ApiShape: map to honest pending
          // instead of letting `data.mandates` come back undefined and crash.
          return {
            mandates: [],
            source: 'pending',
            reason: r.status === 401 ? 'no_wallet_configured' : 'scribe_unavailable',
          } as ApiShape;
        }
        return (await r.json()) as ApiShape;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load mandates'); });
    return () => { cancelled = true; };
  }, [wallet]);

  if (error) {
    return (
      <EmptyState
        title="Mandates unavailable"
        sub={`Could not reach /api/agents/my-mandates · ${error}`}
      />
    );
  }
  if (!data) {
    return <EmptyState title="Loading mandates…" sub="from Scribe" />;
  }
  if (!data.mandates || data.mandates.length === 0) {
    return (
      <EmptyState
        title="No active mandates"
        sub={
          data.source === 'pending'
            ? data.reason === 'no_wallet_configured'
              ? 'Connect a wallet to see mandates issued from it.'
              : 'Scribe is currently unreachable. The mandate list will populate when indexing resumes.'
            : 'Mandates show up here after an agent first acts under one on chain. A Sigil you just signed stays with you and your agent until then. Use New mandate above to delegate.'
        }
      />
    );
  }

  return <MandatesTableWithRevoke mandates={data.mandates} />;
}

function MandatesTableWithRevoke({ mandates }: { mandates: Mandate[] }) {
  const [confirmFor, setConfirmFor] = useState<Mandate | null>(null);
  const { status, revoke, reset } = useRevokeMandate();
  return (
    <div className="overflow-x-auto rounded-md border border-divider">
      <table className="w-full text-sm">
        <thead className="bg-parchment-soft/40 text-[11px] uppercase tracking-wider text-label">
          <tr>
            <th className="px-3 py-2 text-left font-normal">Agent</th>
            <th className="px-3 py-2 text-left font-normal">Intent</th>
            <th className="px-3 py-2 text-left font-normal">Issued</th>
            <th className="px-3 py-2 text-left font-normal">Tx</th>
            <th className="px-3 py-2 text-right font-normal">Revoke</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {mandates.map((m) => {
            const isRowActive =
              status.kind !== 'idle' && status.intentHash === m.intentHash;
            const isRowBusy = isRowActive && status.kind === 'submitting';
            const isRowDone = isRowActive && status.kind === 'success';
            const isRowError = isRowActive && status.kind === 'error';
            return (
              <tr key={`${m.agent}-${m.intentHash}`} className={isRowDone ? 'opacity-50' : ''}>
                <td className="px-3 py-2.5 font-mono text-xs text-ink">
                  {shortenAddr(m.agent)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">
                  {shortenHash(m.intentHash)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">
                  {formatTs(m.issuedAtTimestamp)}
                </td>
                <td className="px-3 py-2.5">
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${m.txHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono text-xs text-ink-soft hover:text-ink"
                  >
                    {shortenHash(m.txHash)} ↗
                  </a>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {isRowDone ? (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${status.hash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-xs text-live underline"
                    >
                      revoked ↗
                    </a>
                  ) : isRowError ? (
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs text-neg underline"
                      title={status.reason}
                    >
                      retry
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmFor(m)}
                      disabled={isRowBusy}
                      className="rounded-md border border-divider px-2.5 py-1 text-xs text-ink-soft hover:border-neg/40 hover:text-neg disabled:opacity-50"
                    >
                      {isRowBusy ? '…' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <RevokeConfirmModal
        mandate={confirmFor}
        onCancel={() => setConfirmFor(null)}
        onConfirm={(m) => {
          setConfirmFor(null);
          revoke(m.intentHash);
        }}
      />
    </div>
  );
}

function RevokeConfirmModal({
  mandate,
  onCancel,
  onConfirm,
}: {
  mandate: Mandate | null;
  onCancel: () => void;
  onConfirm: (m: Mandate) => void;
}) {
  return (
    <Modal open={mandate !== null} onClose={onCancel} label="Revoke mandate">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-2xl italic text-ink">Revoke mandate</p>
        <ModalCloseButton onClose={onCancel} />
      </header>

      {mandate && (
        <>
          <p className="mt-3 text-sm text-ink-soft">
            Revoke mandate for agent{' '}
            <span className="font-mono text-ink">{shortenAddr(mandate.agent)}</span>?
          </p>

          <div className="mt-3 rounded-md border border-divider bg-parchment-light p-3 text-xs">
            <p className="font-medium text-ink">This agent will lose access to:</p>
            <ul className="mt-2 space-y-1 text-ink-soft">
              <li>• Opening any new positions under this mandate</li>
              <li>• Any remaining budget, action quota, or venue allowance from this Sigil</li>
            </ul>
            <p className="mt-3 text-ink-soft">
              <strong className="text-ink">Existing positions opened under this mandate remain
              open.</strong> You can close them yourself from the Portfolio page.
            </p>
          </div>

          <p className="mt-3 font-mono text-[10px] text-muted">
            Intent: {shortenHash(mandate.intentHash)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-divider px-4 py-3 text-sm font-medium text-ink hover:border-ink/30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(mandate)}
              className="rounded-md bg-neg px-4 py-3 text-sm font-medium text-parchment hover:opacity-90"
            >
              Revoke
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-md border border-divider bg-parchment-soft/30 px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{sub}</p>
    </div>
  );
}

function shortenAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function shortenHash(h: string) {
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}
function formatTs(seconds: number) {
  if (!seconds) return '-';
  const d = new Date(seconds * 1000);
  return d.toISOString().slice(0, 10);
}
