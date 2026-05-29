'use client';

import { useState } from 'react';
import { MarketingShell } from '@/components/atrium/MarketingShell';

type Fault =
  | 'oracle_drift'
  | 'keeper_offline'
  | 'partial_fill'
  | 'gas_spike'
  | 'indexer_stall';

interface InjectionResult {
  fault: Fault;
  injectedAt: string;
  recovery: string;
  observedMessage: string;
}

interface InjectionError {
  fault: Fault;
  injectedAt: string;
  error: string;
  detail?: string;
}

type LogEntry = InjectionResult | InjectionError;
const isError = (e: LogEntry): e is InjectionError => 'error' in e;

const FAULT_LABELS: Record<Fault, { label: string; describe: string }> = {
  oracle_drift: {
    label: 'Oracle drift',
    describe: 'Force Chainlink and Pyth to disagree by 75 bps. Plinth must pause within 1 block.',
  },
  keeper_offline: {
    label: 'Keeper offline',
    describe: 'Take the primary keeper down. Vigil falls back to a backup keeper within 30 seconds.',
  },
  partial_fill: {
    label: 'Partial fill',
    describe: 'Adapter fills 60% of a 100% order. Plinth reconciles via margin recompute.',
  },
  gas_spike: {
    label: 'Gas spike',
    describe: 'Multiply gas price by 10x. UI surfaces the higher cost and lets user retry or wait.',
  },
  indexer_stall: {
    label: 'Indexer stall',
    describe: 'Stop Scribe ingestion. UI falls back to direct RPC reads with a banner.',
  },
};

export default function ChaosPage() {
  const [log, setLog] = useState<LogEntry[]>([]);

  // Audit J-C3 fix: previously cast every response to InjectionResult and
  // read fields off undefined when the route returned 400/502/503. Now we
  // branch on r.ok and shape an error entry the renderer can display.
  async function inject(fault: Fault) {
    const injectedAt = new Date().toISOString();
    let r: Response;
    try {
      r = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault }),
      });
    } catch (err) {
      setLog((prev) => [
        {
          fault,
          injectedAt,
          error: 'chaos_agent_unreachable',
          detail: err instanceof Error ? err.message : String(err),
        },
        ...prev,
      ]);
      return;
    }
    if (!r.ok) {
      let detail: string | undefined;
      try {
        const body = (await r.json()) as { error?: string; detail?: string };
        detail = body.detail ?? body.error;
      } catch {
        detail = `HTTP ${r.status}`;
      }
      setLog((prev) => [
        { fault, injectedAt, error: `chaos_inject_${r.status}`, detail },
        ...prev,
      ]);
      return;
    }
    const result = (await r.json()) as InjectionResult;
    setLog((prev) => [result, ...prev]);

    // Phase zeta.5 (2026-05-25): auto-restore after 5 s so the demo
    // self-heals during the Verifier Step 4 walk. Restore is idempotent;
    // failing restores log but don't block.
    setTimeout(() => {
      void fetch('/api/chaos/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault }),
      }).catch(() => {
        // restore-failure is non-blocking; the inject already logged
      });
    }, 5000);
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-5xl text-ink">Chaos Mode</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Each button injects a real fault into the testnet stack. The system handles it
        gracefully or it fails honestly. Every run is logged here and on{' '}
        <code className="font-mono text-ink">chaos.atrium.fi</code>.
      </p>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {(Object.keys(FAULT_LABELS) as Fault[]).map((fault) => (
          <button
            key={fault}
            type="button"
            onClick={() => inject(fault)}
            className="rounded-md border border-divider bg-parchment p-5 text-left hover:border-accent/40"
          >
            <p className="font-medium text-ink">{FAULT_LABELS[fault].label}</p>
            <p className="mt-2 text-sm text-ink-soft">{FAULT_LABELS[fault].describe}</p>
          </button>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Recent runs</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No faults injected this session.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {log.map((r, i) =>
              isError(r) ? (
                <li
                  key={i}
                  className="rounded-md border border-neg/40 bg-neg/5 p-4 text-sm"
                >
                  <p className="font-mono text-ink">{r.fault}</p>
                  <p className="mt-1 font-medium text-neg">{r.error}</p>
                  {r.detail && <p className="mt-1 text-ink-soft">{r.detail}</p>}
                  <p className="mt-1 text-muted">{new Date(r.injectedAt).toLocaleString()}</p>
                </li>
              ) : (
                <li
                  key={i}
                  className="rounded-md border border-divider bg-parchment-soft/40 p-4 text-sm"
                >
                  <p className="font-mono text-ink">{r.fault}</p>
                  <p className="mt-1 text-ink-soft">{r.observedMessage}</p>
                  <p className="mt-1 text-muted">Recovery: {r.recovery}</p>
                  <p className="mt-1 text-muted">{new Date(r.injectedAt).toLocaleString()}</p>
                </li>
              )
            )}
          </ol>
        )}
      </section>
      </div>
    </MarketingShell>
  );
}
