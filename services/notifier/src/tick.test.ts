import { describe, it, expect } from 'vitest';
import { ALERT_KIND } from './types.js';
import type { AlertKind } from './types.js';

/**
 * Phase 2c: drift guard. Every ALERT_KIND value must be a valid AlertKind.
 * If a handler emits a new kind string that the notifier doesn't know about,
 * this test fails in CI before the mismatch reaches production.
 */
describe('ALERT_KIND', () => {
  const ALL_KNOWN_KINDS: Set<string> = new Set(Object.values(ALERT_KIND));

  it('every ALERT_KIND value is a non-empty string', () => {
    for (const [key, value] of Object.entries(ALERT_KIND)) {
      expect(value).toBeTruthy();
      expect(typeof value).toBe('string');
      expect(key).toBe(value); // keys match values (canonical form)
    }
  });

  it('contains all subgraph-emitted kinds', () => {
    const subgraphKinds = [
      'oracle_disagreement',
      'vigil_queue_failed',
      'link_balance_low',
      'usdc_paused',
      'adapter_emergency_deregistered',
      'emergency_pause_invoked',
    ];
    for (const kind of subgraphKinds) {
      expect(ALL_KNOWN_KINDS.has(kind)).toBe(true);
    }
  });

  it('contains notifier-mapped kinds', () => {
    const mappedKinds: AlertKind[] = [
      'liquidation_executed',
      'mandate_revoked',
      'kill_switch_activated',
    ];
    for (const kind of mappedKinds) {
      expect(ALL_KNOWN_KINDS.has(kind)).toBe(true);
    }
  });

  it('has exactly 9 known kinds', () => {
    expect(Object.keys(ALERT_KIND).length).toBe(9);
  });
});
