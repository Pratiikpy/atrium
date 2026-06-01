import { describe, it, expect } from 'vitest';
import { readinessMessage, type DeploymentStatus } from './use-deployment-status';

/**
 * readinessMessage() pure-function tests.
 *
 * Locks audit R-9 (return null while loading so the UI doesn't flash
 * three states per mount) and the helper-text shape every disabled button
 * relies on.
 */
describe('readinessMessage()', () => {
  it('returns null while the status query is loading', () => {
    // Audit R-9 fix: returning null on undefined prevents the
    // loading → not-ready → ready flicker on first paint.
    expect(readinessMessage(undefined, 'Deposit')).toBeNull();
  });

  it('returns null when everything is deployed (button is enabled)', () => {
    const ready: DeploymentStatus = {
      step: 1,
      ready: true,
      required_contracts: ['Coffer'],
      missing: [],
    };
    // If the action is ready, no helper copy is shown, the button speaks for itself.
    expect(readinessMessage(ready, 'Deposit')).toBeNull();
  });

  it('names the missing contracts when present', () => {
    const notReady: DeploymentStatus = {
      step: 2,
      ready: false,
      required_contracts: ['Plinth', 'AaveHorizonAdapterV11'],
      missing: ['Plinth', 'AaveHorizonAdapterV11'],
    };
    const msg = readinessMessage(notReady, 'Open position');
    expect(msg).toContain('Open position');
    expect(msg).toContain('Plinth');
    expect(msg).toContain('AaveHorizonAdapterV11');
  });

  it('falls back to a registry-empty message when ready=false but missing=[]', () => {
    // The deployment registry exists but lists nothing for this step.
    // Surface that as a distinct message rather than a confusing "waits on" line.
    const empty: DeploymentStatus = {
      step: 4,
      ready: false,
      required_contracts: [],
      missing: [],
    };
    const msg = readinessMessage(empty, 'Run chaos');
    expect(msg).toContain('Run chaos');
    expect(msg).toContain('registry is empty');
  });

  it('does NOT include banned marketing words (writing.md rule)', () => {
    const notReady: DeploymentStatus = {
      step: 1,
      ready: false,
      required_contracts: ['Coffer'],
      missing: ['Coffer'],
    };
    const msg = readinessMessage(notReady, 'Deposit')!;
    // docs/conventions/writing.md bans these. Lock the helper copy against
    // accidental drift.
    expect(msg).not.toMatch(/seamless|robust|unleash|leverage|empower/i);
  });

  it('points at a real roadmap doc, not a vague "coming soon"', () => {
    const notReady: DeploymentStatus = {
      step: 1,
      ready: false,
      required_contracts: ['Coffer'],
      missing: ['Coffer'],
    };
    const msg = readinessMessage(notReady, 'Deposit')!;
    // Honesty discipline, the message names a real planning doc with the
    // phase, not a vague "coming soon". The roadmap doc was renamed
    // ATRIUM_12_MONTH_ROADMAP.md → docs/MASTER_PLAN.md; accept either.
    expect(msg).toMatch(/ROADMAP|Month 1 W2|MASTER_PLAN/);
  });
});
