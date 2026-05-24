#!/usr/bin/env node
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  toPascal,
  lookupSource,
  isIgnored,
  CONTRACT_TO_SOURCE,
  INDEXING_IGNORE,
} from './check-event-indexing.mjs';

/**
 * Iter 79 audit fix: pins the helpers that make up the
 * check-event-indexing CI gate. The gate has run 75+ /loop iterations
 * reporting "0 unindexed" — that's strong integration evidence the
 * helpers work today, but a refactor of any helper could silently
 * relax the gate (false negatives → ghost events ship to production).
 *
 * Most important pins:
 * - isIgnored wildcard match: "*.PositionOpened" must match for EVERY
 *   contract name. A regression where the wildcard becomes
 *   case-sensitive or stops matching entirely would silently mark
 *   per-adapter PositionOpened events as unindexed (50+ events
 *   suddenly red on next CI run).
 * - lookupSource null-fallback: contracts not in CONTRACT_TO_SOURCE
 *   default to null → their events are treated as unindexed (loud).
 *   A regression making the default "match by name" would silently
 *   accept the wrong source.
 * - toPascal: Stylus directory slugs like "atrium-router" must become
 *   "AtriumRouter" exactly to match the CONTRACT_TO_SOURCE map. Drift
 *   here would orphan every Stylus event.
 */

describe('toPascal', () => {
  it('converts kebab-case to PascalCase', () => {
    assert.equal(toPascal('atrium-router'), 'AtriumRouter');
    assert.equal(toPascal('lantern-attestor'), 'LanternAttestor');
    assert.equal(toPascal('portico-registry'), 'PorticoRegistry');
  });

  it('converts snake_case to PascalCase', () => {
    assert.equal(toPascal('atrium_router'), 'AtriumRouter');
    assert.equal(toPascal('praetor_timelock'), 'PraetorTimelock');
  });

  it('handles single-word slugs', () => {
    assert.equal(toPascal('plinth'), 'Plinth');
    assert.equal(toPascal('coffer'), 'Coffer');
  });

  it('handles already-PascalCased input (idempotent first letter)', () => {
    assert.equal(toPascal('Plinth'), 'Plinth');
  });

  it('handles empty string', () => {
    assert.equal(toPascal(''), '');
  });
});

describe('lookupSource', () => {
  it('returns the mapped source for known contracts', () => {
    assert.equal(lookupSource('Plinth'), 'Plinth');
    assert.equal(lookupSource('Aqueduct'), 'Aqueduct');
    assert.equal(lookupSource('AtriumRouter'), 'AtriumRouter');
    assert.equal(lookupSource('Curator'), 'Curator');
  });

  it('returns null for contracts intentionally NOT indexed', () => {
    // StoaBlackScholes is pure math — no events. Null is the correct
    // "events go nowhere" signal.
    assert.equal(lookupSource('StoaBlackScholes'), null);
    // AqueductReceiver lives on the destination chain (separate subgraph).
    assert.equal(lookupSource('AqueductReceiver'), null);
    assert.equal(lookupSource('AqueductClaimback'), null);
  });

  it('returns null for adapters not in CONTRACT_TO_SOURCE', () => {
    // Adapters (CurveAdapter, HyperliquidHybridAdapter, etc.) ride on
    // Plinth/Router events. Their own events aren't separately indexed
    // → lookupSource returns null → events flow to the INDEXING_IGNORE
    // allow-list check (which has wildcard entries for adapter shapes).
    assert.equal(lookupSource('CurveAdapter'), null);
    assert.equal(lookupSource('HyperliquidHybridAdapter'), null);
    assert.equal(lookupSource('PolymarketAdapter'), null);
  });

  it('returns null for an unrecognized contract name (loud-fallback)', () => {
    // Defensive: a new contract added without a CONTRACT_TO_SOURCE
    // entry defaults to null. The gate then either matches against
    // INDEXING_IGNORE or reports unindexed (loud failure, not silent
    // accept).
    assert.equal(lookupSource('NewContractFromTheFuture'), null);
  });
});

describe('isIgnored — wildcard matching', () => {
  it('matches *.EventName wildcard for any contract', () => {
    // INDEXING_IGNORE has '*.PositionOpened'. Every adapter's
    // PositionOpened event must match this wildcard.
    assert.equal(isIgnored('CurveAdapter', 'PositionOpened'), true);
    assert.equal(isIgnored('GmxV2Adapter', 'PositionOpened'), true);
    assert.equal(isIgnored('HyperliquidHybridAdapter', 'PositionOpened'), true);
    assert.equal(isIgnored('PolymarketAdapter', 'PositionOpened'), true);
  });

  it('matches *.EventName for VenueHealthChanged (view-only events)', () => {
    assert.equal(isIgnored('CurveAdapter', 'VenueHealthChanged'), true);
    assert.equal(isIgnored('HyperliquidHybridAdapter', 'VenueHealthChanged'), true);
  });

  it('matches *.AuthorizedCallerUpdated (Praetor-action surrogate)', () => {
    // iter-60 added this event to 9 adapters; the gate treats it as
    // captured via PraetorTimelock.Executed, so the wildcard
    // suppresses it across all adapters.
    assert.equal(isIgnored('SynthetixV3Adapter', 'AuthorizedCallerUpdated'), true);
    assert.equal(isIgnored('AaveHorizonAdapterV11', 'AuthorizedCallerUpdated'), true);
  });

  it('matches contract-specific ignores (Contract.EventName)', () => {
    // Aqueduct.LinkUsage30dUpdated is contract-specific (only Aqueduct
    // has it), not a wildcard.
    assert.equal(isIgnored('Aqueduct', 'LinkUsage30dUpdated'), true);
    // The wildcard doesn't apply — another contract emitting the same
    // event name would NOT be auto-ignored.
    assert.equal(isIgnored('OtherContract', 'LinkUsage30dUpdated'), false);
  });

  it('returns false for events NOT in the allow-list', () => {
    // Hypothetical "totally new event" should be reported unindexed.
    assert.equal(isIgnored('Plinth', 'NewMarginEvent2026'), false);
    assert.equal(isIgnored('Aqueduct', 'NeverDefinedEvent'), false);
  });

  it('is case-sensitive on contract + event names', () => {
    // The INDEXING_IGNORE map is a case-sensitive Map. A typo'd ignore
    // entry MUST NOT silently match.
    assert.equal(isIgnored('aqueduct', 'LinkUsage30dUpdated'), false); // lowercase contract
    assert.equal(isIgnored('Aqueduct', 'linkusage30dupdated'), false); // lowercase event
  });
});

describe('INDEXING_IGNORE shape', () => {
  it('every entry has a non-empty reason string', () => {
    // The ignore list is the audit trail. Every entry must explain
    // WHY it's ignored so a future maintainer can re-evaluate. Pin
    // that no future contributor adds a bare-key entry.
    for (const [key, reason] of INDEXING_IGNORE) {
      assert.equal(typeof reason, 'string', `${key} reason must be string`);
      assert.ok(reason.length > 5, `${key} reason too short: "${reason}"`);
    }
  });

  it('every key follows "Contract.EventName" or "*.EventName" shape', () => {
    for (const key of INDEXING_IGNORE.keys()) {
      assert.match(key, /^(\*|[A-Z][A-Za-z0-9]+)\.[A-Z][A-Za-z0-9]+$/,
        `INDEXING_IGNORE key "${key}" must be Contract.Event or *.Event shape`);
    }
  });
});

describe('CONTRACT_TO_SOURCE shape', () => {
  it('Stylus contracts all map to a non-null source', () => {
    // Plinth/Coffer/Vigil/Sigil are Stylus contracts that DO have
    // subgraph data sources. Their events MUST be indexed (no nulls).
    assert.equal(CONTRACT_TO_SOURCE.Plinth, 'Plinth');
    assert.equal(CONTRACT_TO_SOURCE.Coffer, 'Coffer');
    assert.equal(CONTRACT_TO_SOURCE.Vigil, 'Vigil');
    assert.equal(CONTRACT_TO_SOURCE.Sigil, 'Sigil');
  });

  it('AqueductReceiver + AqueductClaimback are explicitly null', () => {
    // Destination-chain contracts. A future contributor must NOT
    // accidentally map them to the source-chain Aqueduct subgraph.
    assert.equal(CONTRACT_TO_SOURCE.AqueductReceiver, null);
    assert.equal(CONTRACT_TO_SOURCE.AqueductClaimback, null);
  });

  it('every non-null source matches itself (no aliasing surprises today)', () => {
    // Current convention: contract name == source name. Pin this so a
    // future alias (e.g. mapping "Plinth" → "PlinthV2") is a deliberate
    // change, not a silent rename.
    for (const [contract, source] of Object.entries(CONTRACT_TO_SOURCE)) {
      if (source !== null) {
        assert.equal(source, contract,
          `CONTRACT_TO_SOURCE[${contract}] = ${source} — alias check (set to null if intentional)`);
      }
    }
  });
});
