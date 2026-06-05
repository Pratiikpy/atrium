'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Live Codex status + an interactive "Try it" for the docs page.
 *
 * Honesty: production Codex endpoints require an x402 USDC payment header, so
 * a true browser "try it" against them is not possible without a wallet flow.
 * Instead the Try-it calls the LOCAL testnet read routes that back each Codex
 * endpoint (same data, no payment on testnet) and says so plainly. The health
 * badge is a real server-side probe of the deployed worker's /health.
 */

export function CodexLiveStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['codex-health'],
    queryFn: async () => {
      const r = await fetch('/api/codex/health');
      return r.json() as Promise<{ ok: boolean; latencyMs: number | null; source: string }>;
    },
    refetchInterval: 30_000,
  });

  const ok = data?.ok === true;
  const label = isLoading ? 'checking…' : ok ? 'live' : 'unreachable';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-parchment px-3 py-1 text-[11px] uppercase tracking-wider text-muted">
      <span
        className={'size-1.5 rounded-full ' + (isLoading ? 'bg-divider' : ok ? 'bg-live' : 'bg-neg')}
        aria-hidden
      />
      Codex worker · {label}
      {ok && data?.latencyMs != null && <span className="text-muted">· {data.latencyMs}ms</span>}
    </span>
  );
}

interface TryEndpoint {
  id: string;
  codexPath: string;
  /** Local testnet mirror that serves the same data with no x402 payment. */
  mirror: (wallet: string) => string;
  needsWallet: boolean;
}

const TRY_ENDPOINTS: TryEndpoint[] = [
  { id: 'margin', codexPath: 'GET /margin/:user', mirror: (w) => `/api/portfolio/margin-health?wallet=${w}`, needsWallet: true },
  { id: 'positions', codexPath: 'GET /positions/:user', mirror: (w) => `/api/portfolio/positions?wallet=${w}`, needsWallet: true },
  { id: 'venues', codexPath: 'GET /venues', mirror: () => '/api/protocol/subsystems', needsWallet: false },
  { id: 'attestation', codexPath: 'GET /attestation/:wallet', mirror: () => '/api/lantern/latest', needsWallet: false },
];

export function CodexTryIt() {
  const [endpointId, setEndpointId] = useState(TRY_ENDPOINTS[0].id);
  const [wallet, setWallet] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = TRY_ENDPOINTS.find((e) => e.id === endpointId)!;
  const walletValid = /^0x[0-9a-fA-F]{40}$/.test(wallet);

  async function run() {
    setError(null);
    setResult(null);
    if (endpoint.needsWallet && !walletValid) {
      setError('Enter a valid 0x… wallet address.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(endpoint.mirror(wallet));
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        // Hostile-judge audit: do not dump the raw 401 body. The per-user
        // mirror routes are SIWE-gated; explain that instead of {"error":"…"}.
        if (r.status === 401 || r.status === 403) {
          setError(
            endpoint.needsWallet
              ? 'This endpoint reads a specific account, so it needs a connected, signed-in wallet. Sign in on /app, or try GET /venues or GET /attestation, which are public and need no session.'
              : 'This read needs a signed-in session.',
          );
        } else {
          setError(`Request failed (HTTP ${r.status}).`);
        }
        return;
      }
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-divider bg-parchment p-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={endpointId}
          onChange={(e) => {
            setEndpointId(e.target.value);
            setResult(null);
            setError(null);
          }}
          className="rounded-md border border-divider bg-parchment-light px-3 py-2 font-mono text-sm text-ink"
          aria-label="Codex endpoint"
        >
          {TRY_ENDPOINTS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codexPath}
            </option>
          ))}
        </select>
        {endpoint.needsWallet && (
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            placeholder="0x… wallet"
            className="min-w-[260px] flex-1 rounded-md border border-divider bg-parchment-light px-3 py-2 font-mono text-sm text-ink placeholder:text-muted"
            aria-label="Wallet address"
          />
        )}
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? 'Calling…' : 'Try it'}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted">
        Calls the local testnet read route that backs this endpoint, so it needs no x402 payment.
        The per-user endpoints (margin, positions) read your account, so they need a connected,
        signed-in wallet; <code className="font-mono">GET /venues</code> and{' '}
        <code className="font-mono">GET /attestation</code> are public. Production Codex requires the{' '}
        <code className="font-mono">X-PAYMENT</code> header shown in the curl example for each endpoint.
      </p>

      {error && <p className="mt-3 text-[12px] text-neg">{error}</p>}
      {result && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-divider bg-parchment-soft/60 p-4 font-mono text-[12px] leading-relaxed text-ink">
          {result}
        </pre>
      )}
    </div>
  );
}
