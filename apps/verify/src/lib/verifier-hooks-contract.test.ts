import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit U-29: URL-contract invariants for the four live Verifier-Mode
 * action hooks.
 *
 * The four live actions (deposit, chaos-inject, lantern-verify,
 * kill-switch) each delegate to a backing API route. If a refactor
 * renames a route without updating the hook (or vice versa) the demo
 * silently breaks. This test pins each hook's expected fetch path so
 * the link can't drift.
 *
 * Static (file-text) rather than runtime because the verify-app's
 * vitest env doesn't have React Testing Library and the hooks all use
 * React `useState` + (some) wagmi hooks that need a Provider.
 */

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)));

interface HookContract {
  file: string;
  /** Fetch URLs the hook MUST reference. */
  requiredUrls: string[];
  /** Fetch URLs the hook MUST NOT reference (catches stale paths). */
  forbiddenUrls?: string[];
}

const HOOK_CONTRACTS: HookContract[] = [
  // Step 1 (coffer-deposit). The deposit hook itself doesn't fetch — it
  // uses wagmi useWriteContract — but the deployment-status gate goes
  // through /api/deployments/status. The address hook used inside
  // the deposit-card component goes through /api/deployments/address.
  // Both are covered by use-coffer-address + use-deployment-status tests
  // elsewhere; this contract pins the writeContract function names.
  {
    file: 'use-vault-deposit.ts',
    requiredUrls: [],
  },
  {
    file: 'use-vault-withdraw.ts',
    requiredUrls: [],
  },
  // Step 4 (chaos-inject). Posts to /api/chaos/inject.
  {
    file: 'use-chaos-inject.ts',
    requiredUrls: ['/api/chaos/inject'],
  },
  // Step 6 (lantern-verify). Read /api/lantern/latest then POST
  // /api/lantern/verify-inclusion with {root, ipfsCid, wallet}.
  {
    file: 'use-lantern-verify.ts',
    requiredUrls: ['/api/lantern/latest', '/api/lantern/verify-inclusion'],
  },
  // Step 7 (postern-kill-switch). Reads /api/agents/my-mandates to
  // compute the agent list, then calls PosternKillSwitch.activate via
  // wagmi.
  {
    file: 'use-kill-switch.ts',
    requiredUrls: ['/api/agents/my-mandates'],
  },
  // Issue-mandate (NewMandateButton modal). Posts the signed EIP-712
  // envelope to /api/agents/issue-mandate after wagmi signTypedDataAsync.
  {
    file: 'use-issue-mandate.ts',
    requiredUrls: ['/api/agents/issue-mandate'],
  },
  // Open-position (Trade form). Phase theta audit follow-up
  // (2026-05-25): routed through AtriumRouter.open_position_via_adapter
  // — pre-fix the hook called adapter.open_position directly from the
  // user's wallet, which fails Unauthorized (only the Router is on the
  // adapter's authorized-caller list) AND bypasses Coffer.adapterPull.
  {
    file: 'use-open-position.ts',
    requiredUrls: ['/api/deployments/address?slug=atrium-router'],
    forbiddenUrls: [
      // The Router resolves the adapter from the registry itself;
      // the front-end no longer threads adapter addresses through.
      '/api/deployments/address?slug=adapter-',
    ],
  },
  // Close-position (open-positions table row). Same Router routing as
  // open, then AtriumRouter.close_position_via_adapter.
  {
    file: 'use-close-position.ts',
    requiredUrls: ['/api/deployments/address?slug=atrium-router'],
    forbiddenUrls: ['/api/deployments/address?slug=adapter-'],
  },
];

describe('Verifier hooks ↔ API route URL contract', () => {
  for (const contract of HOOK_CONTRACTS) {
    it(`${contract.file} references every required route URL`, () => {
      const text = readFileSync(join(LIB_DIR, contract.file), 'utf8');
      for (const url of contract.requiredUrls) {
        expect(text).toContain(url);
      }
      for (const url of contract.forbiddenUrls ?? []) {
        expect(text).not.toContain(url);
      }
    });
  }

  // Belt-and-suspenders: the use-vault-deposit hook is the one Step-1
  // backing piece that goes through wagmi rather than fetch. Confirm it
  // wires the canonical ERC-4626 deposit function name + the
  // address-import path so a future refactor doesn't accidentally call
  // a different function.
  it('use-vault-deposit.ts calls coffer.deposit() via wagmi writeContract', () => {
    const text = readFileSync(join(LIB_DIR, 'use-vault-deposit.ts'), 'utf8');
    expect(text).toContain('useWriteContract');
    expect(text).toContain("functionName: 'deposit'");
  });

  it('use-kill-switch.ts calls PosternKillSwitch.activate() via wagmi writeContract', () => {
    const text = readFileSync(join(LIB_DIR, 'use-kill-switch.ts'), 'utf8');
    expect(text).toContain('useWriteContract');
    expect(text).toContain("functionName: 'activate'");
  });

  it('use-vault-withdraw.ts calls coffer.redeem() via wagmi writeContract', () => {
    const text = readFileSync(join(LIB_DIR, 'use-vault-withdraw.ts'), 'utf8');
    expect(text).toContain('useWriteContract');
    expect(text).toContain("functionName: 'redeem'");
  });

  it('use-open-position.ts calls AtriumRouter.open_position_via_adapter via wagmi', () => {
    // Phase theta audit follow-up (2026-05-25): Router-routed instead of
    // direct-adapter. Pin the function name so a regression that calls
    // adapter.open_position directly from the user's wallet (which
    // reverts Unauthorized) fails this test loud.
    const text = readFileSync(join(LIB_DIR, 'use-open-position.ts'), 'utf8');
    expect(text).toContain('useWriteContract');
    expect(text).toContain("functionName: 'open_position_via_adapter'");
    expect(text).not.toContain("functionName: 'open_position'");
  });

  it('use-close-position.ts calls AtriumRouter.close_position_via_adapter via wagmi', () => {
    const text = readFileSync(join(LIB_DIR, 'use-close-position.ts'), 'utf8');
    expect(text).toContain('useWriteContract');
    expect(text).toContain("functionName: 'close_position_via_adapter'");
    expect(text).not.toContain("functionName: 'close_position'");
  });

  it('use-issue-mandate.ts signs EIP-712 via wagmi useSignTypedData', () => {
    // Issue-mandate is the only hook that uses signTypedData (not
    // writeContract) — the signed envelope is posted to a server route
    // rather than written on-chain. Locks the wagmi function name.
    const text = readFileSync(join(LIB_DIR, 'use-issue-mandate.ts'), 'utf8');
    expect(text).toContain('useSignTypedData');
    expect(text).toContain('signTypedDataAsync');
  });

  it('use-open-position.ts resolves venueId from the canonical VENUES list', () => {
    // Phase theta audit follow-up (2026-05-25): after the Router-routing
    // refactor, the hook no longer needs adapter-slug resolution
    // (the Router consults PorticoRegistry itself). It still reads the
    // numeric venueId from VENUES to pass to the Router's first arg.
    const text = readFileSync(join(LIB_DIR, 'use-open-position.ts'), 'utf8');
    expect(text).toContain('VENUES.find');
    expect(text).toContain('venue.venueId');
  });

  it('every live action kind in verifier-step-config has a corresponding hook import', () => {
    // Cross-check: each non-pending action.kind in STEP_CONFIG should
    // have a corresponding `useXxx` hook imported in the step runner.
    // Catches "added a new live step but forgot to wire it" regressions.
    const runner = readFileSync(
      join(LIB_DIR, '..', 'components', 'verifier-step-runner.tsx'),
      'utf8',
    );
    const expectedImports: { kind: string; hookImport: string }[] = [
      { kind: 'coffer-deposit', hookImport: 'useVaultDeposit' },
      { kind: 'chaos-inject', hookImport: 'useChaosInject' },
      { kind: 'lantern-verify', hookImport: 'useLanternVerify' },
      { kind: 'postern-kill-switch', hookImport: 'useKillSwitch' },
    ];
    for (const { kind, hookImport } of expectedImports) {
      expect(runner, `runner must import ${hookImport} for action.kind=${kind}`).toContain(
        hookImport,
      );
    }
  });
});
