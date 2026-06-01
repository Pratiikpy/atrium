import { describe, it, expect } from 'vitest';
import { getStepConfig, STEP_CONFIG, VERIFIER_STEP_COUNT } from './verifier-step-config';

/**
 * Locks the canonical Verifier-Mode step list. The judge demo script
 * (PRD §26.1) and ui.md both reference steps 1–7 in this exact order.
 * If a future iter renames a step or changes the action kind, this test
 * catches it before the demo breaks.
 *
 * Also pins that:
 *   - step 1 is the only step with a real on-chain action wired today
 *     (coffer-deposit). All others should advertise themselves as
 *     pending until the contracts deploy.
 *   - getStepConfig() degrades safely on unknown steps (no throw).
 */

describe('STEP_CONFIG', () => {
  it('declares exactly seven steps', () => {
    expect(VERIFIER_STEP_COUNT).toBe(7);
    expect(Object.keys(STEP_CONFIG).map(Number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('step 1 is the live coffer-deposit action', () => {
    const s1 = STEP_CONFIG[1];
    expect(s1.action.kind).toBe('coffer-deposit');
    if (s1.action.kind === 'coffer-deposit') {
      // Demo amount is fixed so the judge flow is reproducible.
      expect(s1.action.amountUsd).toBe('10');
    }
  });

  it('live actions are steps 1, 4, 6, 7 (the off-chain + read-only + Coffer + Postern paths)', () => {
    // Each is one-click testable today. Steps 2, 3, 5 still depend on
    // Plinth + Vigil contracts and ship in waves.
    const liveSteps = Object.values(STEP_CONFIG).filter(
      (s) => !(s.action as { pending?: boolean }).pending,
    );
    expect(liveSteps.map((s) => s.step).sort((a, b) => a - b)).toEqual([1, 4, 6, 7]);
  });

  it('steps 2, 3, 5 carry pending (4 wired by U-27, 6 by U-26, 7 by U-18)', () => {
    for (const step of [2, 3, 5]) {
      const action = STEP_CONFIG[step].action;
      expect((action as { pending?: boolean }).pending).toBe(true);
    }
  });

  it('step 4 is the live chaos-inject action (POSTs to /api/chaos/inject)', () => {
    expect(STEP_CONFIG[4].action.kind).toBe('chaos-inject');
    expect((STEP_CONFIG[4].action as { pending?: boolean }).pending).toBeUndefined();
  });

  it('step 7 is the live postern-kill-switch action', () => {
    expect(STEP_CONFIG[7].action.kind).toBe('postern-kill-switch');
    expect((STEP_CONFIG[7].action as { pending?: boolean }).pending).toBeUndefined();
  });

  it('step 6 is the live lantern-verify action (read-only, no contract write)', () => {
    expect(STEP_CONFIG[6].action.kind).toBe('lantern-verify');
    expect((STEP_CONFIG[6].action as { pending?: boolean }).pending).toBeUndefined();
  });

  it('every step has a non-empty pendingReason naming the blocker', () => {
    for (const step of Object.values(STEP_CONFIG)) {
      expect(step.pendingReason.length).toBeGreaterThan(20);
      // Pre-fix the runner threw a generic "wiring lands later" message
      // for every step. Specific blockers must reference either a
      // contract name or the docs/ROADMAP.md month.
      const r = step.pendingReason.toLowerCase();
      const namesContract =
        r.includes('coffer') ||
        r.includes('plinth') ||
        r.includes('vigil') ||
        r.includes('lantern') ||
        r.includes('postern') ||
        r.includes('sigil') ||
        r.includes('chaos');
      const namesRoadmap = r.includes('month');
      expect(namesContract || namesRoadmap).toBe(true);
    }
  });

  it('action kinds are exhaustive, each step has a distinct kind', () => {
    const kinds = Object.values(STEP_CONFIG).map((s) => s.action.kind);
    expect(new Set(kinds).size).toBe(7);
  });
});

describe('getStepConfig', () => {
  it('returns the config for valid steps', () => {
    expect(getStepConfig(1)?.action.kind).toBe('coffer-deposit');
    expect(getStepConfig(7)?.action.kind).toBe('postern-kill-switch');
  });

  it('returns null for out-of-range steps without throwing', () => {
    expect(getStepConfig(0)).toBeNull();
    expect(getStepConfig(8)).toBeNull();
    expect(getStepConfig(-1)).toBeNull();
    expect(getStepConfig(999)).toBeNull();
  });
});
