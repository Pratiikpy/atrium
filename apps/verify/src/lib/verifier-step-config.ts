/**
 * Per-step metadata for the Verifier-Mode runner. Maps each judge-facing
 * step to the contract / off-chain route that will actually execute it
 * plus the honest "what runs on click" copy.
 *
 * Step 1 ships first (Coffer deposit, exercises the same path as the
 * vault page). Steps 2–7 each carry a specific "pending Month X" message
 * so the runner can render an honest disabled state instead of a generic
 * "wiring lands later" stub.
 */

export type VerifierAction =
  | {
      kind: 'coffer-deposit';
      // Fixed demo amount so the judge flow is reproducible. $10 USDC
      // (small enough to fit any faucet drop, big enough to compute non-
      // zero margin).
      amountUsd: '10';
    }
  | { kind: 'plinth-open-position'; pending: true }
  | { kind: 'plinth-recompute-margin'; pending: true }
  // Audit U-27: step 4 wired with real POST to /api/chaos/inject. The
  // route itself gates on PRAETOR_CHAOS_URL, when the agent isn't
  // deployed, it returns honest 503 with a named reason. The hook
  // surfaces that as an error status; once the agent ships, the same
  // POST returns 200 with the fault-recovery timing.
  | { kind: 'chaos-inject' }
  | { kind: 'vigil-liquidate'; pending: true }
  // Audit U-26: step 6 wired with real /api/lantern/verify-inclusion. The
  // action is read-only (no contract write), fetch the latest
  // attestation, post wallet+root+cid, surface the result. No `pending`
  // flag needed once the route works end-to-end.
  | { kind: 'lantern-verify' }
  // Audit U-18: step 7 wired with real PosternKillSwitch.activate(...) once
  // the contract lands. The action carries no parameters because the agent
  // list is computed at click-time from /api/agents/my-mandates.
  | { kind: 'postern-kill-switch' };

export interface StepConfig {
  step: number;
  title: string;
  action: VerifierAction;
  /** What goes in the deployment-not-ready banner. Names the blocker. */
  pendingReason: string;
}

export const STEP_CONFIG: Record<number, StepConfig> = {
  1: {
    step: 1,
    title: 'Deposit USDC to Coffer',
    action: { kind: 'coffer-deposit', amountUsd: '10' },
    pendingReason:
      'Coffer ERC-4626 vault is not in the deployments registry yet. Step 1 deploys in Month 1 W2.',
  },
  2: {
    step: 2,
    title: 'Open a hedged position on Plinth',
    action: { kind: 'plinth-open-position', pending: true },
    pendingReason:
      'Plinth Stylus contract not deployed yet (see docs/MASTER_PLAN.md Phase 2).',
  },
  3: {
    step: 3,
    title: 'Trigger margin recompute',
    action: { kind: 'plinth-recompute-margin', pending: true },
    pendingReason:
      'Plinth margin-update path ships with the Plinth deploy (Month 1 W2).',
  },
  4: {
    step: 4,
    title: 'Inject chaos: oracle drift',
    action: { kind: 'chaos-inject' },
    // Wired live by U-27. /api/chaos/inject already returns honest 503
    // until PRAETOR_CHAOS_URL is set (per docs/MASTER_PLAN.md Phase 9); the
    // hook surfaces that 503 as a typed error so the button shows the
    // named blocker without faking a successful inject.
    pendingReason:
      'PRAETOR_CHAOS_URL not configured. Chaos agent deploys per docs/MASTER_PLAN.md Phase 9.',
  },
  5: {
    step: 5,
    title: 'Trigger liquidation via Vigil',
    action: { kind: 'vigil-liquidate', pending: true },
    pendingReason: 'Vigil liquidator deploys in Month 1 W2 alongside Plinth.',
  },
  6: {
    step: 6,
    title: 'Verify against Lantern proof-of-reserves',
    action: { kind: 'lantern-verify' },
    // Wired live by audit U-26. The action is a read-only inclusion-
    // proof check, no contract deploy needed. It fails honestly with
    // `no_attestation_yet` until the Lantern attestor cron publishes
    // its first attestation (per docs/MASTER_PLAN.md Phase 6), at which
    // point the same code path succeeds with the real Merkle inclusion
    // result.
    pendingReason:
      'No Lantern attestation indexed yet, the read path is wired but the cron defers to Month 6.',
  },
  7: {
    step: 7,
    title: 'Kill Switch: revoke every mandate + session key',
    action: { kind: 'postern-kill-switch' },
    // Wired live by audit U-18, fires PosternKillSwitch.activate(...)
    // when the contract is in the deployments registry. Until then the
    // deployment-status gate (which reads `?step=7`) keeps the button
    // disabled and renders this banner instead.
    pendingReason:
      'PosternKillSwitch not deployed yet. Sigil + Postern key registry land per docs/MASTER_PLAN.md Phase 2.',
  },
};

export function getStepConfig(step: number): StepConfig | null {
  return STEP_CONFIG[step] ?? null;
}

export const VERIFIER_STEP_COUNT = Object.keys(STEP_CONFIG).length;
