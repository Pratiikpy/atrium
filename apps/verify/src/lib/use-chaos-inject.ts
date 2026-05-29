'use client';

import { useState } from 'react';

/**
 * Chaos-inject runner — POSTs a whitelisted fault to /api/chaos/inject
 * which forwards to the Praetor chaos agent.
 *
 * The route already gates on `PRAETOR_CHAOS_URL`: when the agent isn't
 * deployed, it returns 503 with `chaos_agent_not_deployed`. We surface
 * that reason honestly instead of pretending the inject succeeded.
 *
 * For the Verifier-Mode demo we use `oracle_drift` — the most
 * judge-visible fault since it ripples through Plinth's dual-oracle
 * tolerance check and Vigil's liquidation queue.
 *
 * Honest failure modes:
 *   - Praetor agent undeployed → `chaos_agent_not_deployed`
 *   - Agent unreachable → `agent_unreachable`
 *   - Agent rejected the fault → status from the agent body
 */

const DEFAULT_FAULT = 'oracle_drift';

export type ChaosStatus =
  | { kind: 'idle' }
  | { kind: 'submitting'; fault: string }
  | {
      kind: 'success';
      fault: string;
      recoveredInMs: number | null;
    }
  | { kind: 'error'; fault: string; reason: string };

export function useChaosInject() {
  const [status, setStatus] = useState<ChaosStatus>({ kind: 'idle' });

  async function inject(fault: string = DEFAULT_FAULT) {
    setStatus({ kind: 'submitting', fault });
    try {
      const r = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        // The route's pending shape is `{ error, detail }` with 503; treat
        // detail as the reason so the user sees the named blocker (e.g.
        // "PRAETOR_CHAOS_URL not configured. Praetor chaos agent deploys
        // per docs/MASTER_PLAN.md Phase 9.").
        const reason: string =
          body?.detail || body?.error || `chaos_inject_${r.status}`;
        setStatus({ kind: 'error', fault, reason });
        return;
      }
      // Success body shape from the agent: `{ ok: true, recoveredIn: <ms> }`.
      // recoveredIn may be missing on partial-info responses; null is fine.
      const recoveredInMs =
        typeof body?.recoveredIn === 'number' ? body.recoveredIn : null;
      setStatus({ kind: 'success', fault, recoveredInMs });
    } catch (e) {
      setStatus({
        kind: 'error',
        fault,
        reason: e instanceof Error ? e.message : 'unknown_error',
      });
    }
  }

  function reset() {
    setStatus({ kind: 'idle' });
  }

  return { status, inject, reset, defaultFault: DEFAULT_FAULT };
}
