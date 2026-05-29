import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from './route';

/**
 * The deployments/status route powers every disabled-button surface in the
 * verify app via `useDeploymentStatus(step)`. If the response shape ever
 * drifts, every step's run button silently breaks.
 *
 * Phase 8 update: response now includes `blocker` field driven by on-chain
 * state. `ready` can be false even when `missing.length === 0` if a blocker
 * is detected (e.g. router not authorized on adapters).
 */

function makeReq(stepParam: string | null): NextRequest {
  const url = stepParam === null
    ? 'http://localhost/api/deployments/status'
    : `http://localhost/api/deployments/status?step=${encodeURIComponent(stepParam)}`;
  return new Request(url) as unknown as NextRequest;
}

async function call(stepParam: string | null) {
  const res = await GET(makeReq(stepParam));
  expect(res.status).toBe(200);
  return (await res.json()) as {
    step: number;
    ready: boolean;
    blocker: string | null;
    init_state: 'initialized' | 'uninitialized' | 'unknown';
    required_contracts: string[];
    missing: string[];
    probes: Record<string, { address: string | null; init: string; reason: string | null }>;
  };
}

describe('GET /api/deployments/status — step clamping', () => {
  it('defaults to step 1 when no param is provided', async () => {
    const json = await call(null);
    expect(json.step).toBe(1);
    expect(json.required_contracts).toEqual(['coffer']);
  });

  it('defaults to step 1 on non-numeric input', async () => {
    expect((await call('foo')).step).toBe(1);
    expect((await call('')).step).toBe(1);
    expect((await call('abc123')).step).toBe(1);
  });

  it('clamps below 1 → 1', async () => {
    expect((await call('0')).step).toBe(1);
    expect((await call('-5')).step).toBe(1);
  });

  it('clamps above 7 → 7', async () => {
    expect((await call('8')).step).toBe(7);
    expect((await call('999')).step).toBe(7);
  });

  it('passes through 1..7 unchanged', async () => {
    for (let i = 1; i <= 7; i++) {
      expect((await call(String(i))).step).toBe(i);
    }
  });

  it('truncates fractional input to integer', async () => {
    expect((await call('3.7')).step).toBe(3);
    expect((await call('2.0')).step).toBe(2);
  });
});

describe('GET /api/deployments/status — STEP_REQUIREMENTS mapping', () => {
  it('step 1 → coffer (deposit path)', async () => {
    const json = await call('1');
    expect(json.required_contracts).toEqual(['coffer']);
  });

  it('step 2 → plinth + atrium-router (open_position path)', async () => {
    const json = await call('2');
    expect(json.required_contracts).toEqual(['plinth', 'atrium-router']);
  });

  it('step 3 → plinth + atrium-router (margin recompute)', async () => {
    const json = await call('3');
    expect(json.required_contracts).toEqual(['plinth', 'atrium-router']);
  });

  it('step 4 → plinth (chaos / oracle drift scenario)', async () => {
    const json = await call('4');
    expect(json.required_contracts).toEqual(['plinth']);
  });

  it('step 5 → vigil + plinth (liquidation path)', async () => {
    const json = await call('5');
    expect(json.required_contracts).toEqual(['vigil', 'plinth']);
  });

  it('step 6 → lantern-attestor (proof of reserves)', async () => {
    const json = await call('6');
    expect(json.required_contracts).toEqual(['lantern-attestor']);
  });

  it('step 7 → postern-kill-switch + sigil (Kill Switch revoke)', async () => {
    const json = await call('7');
    expect(json.required_contracts).toEqual(['postern-kill-switch', 'sigil']);
  });
});

describe('GET /api/deployments/status — response invariants', () => {
  it('always returns a complete StepStatus object — never throws', async () => {
    for (let i = 0; i <= 8; i++) {
      const json = await call(String(i));
      expect(json).toHaveProperty('step');
      expect(json).toHaveProperty('ready');
      expect(json).toHaveProperty('blocker');
      expect(json).toHaveProperty('init_state');
      expect(json).toHaveProperty('required_contracts');
      expect(json).toHaveProperty('missing');
      expect(json).toHaveProperty('probes');
      expect(Array.isArray(json.required_contracts)).toBe(true);
      expect(Array.isArray(json.missing)).toBe(true);
      expect(typeof json.ready).toBe('boolean');
      expect(['initialized', 'uninitialized', 'unknown']).toContain(json.init_state);
    }
  });

  it('ready=false when missing.length > 0', async () => {
    for (let i = 1; i <= 7; i++) {
      const json = await call(String(i));
      if (json.missing.length > 0) {
        expect(json.ready).toBe(false);
      }
    }
  });

  it('ready=false when blocker is non-null', async () => {
    for (let i = 1; i <= 7; i++) {
      const json = await call(String(i));
      if (json.blocker !== null) {
        expect(json.ready).toBe(false);
      }
    }
  });
});
