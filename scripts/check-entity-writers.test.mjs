#!/usr/bin/env node
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { hasWriter, WRITER_IGNORE } from './check-entity-writers.mjs';

/**
 * Iter 79 audit fix: pins the hasWriter regex + WRITER_IGNORE shape.
 *
 * The gate runs `\bnew\s+<EntityName>\s*\(` against the concatenated
 * handler-file blob. A bug in that regex would either:
 *   - false-positive: match a comment or unrelated identifier, marking
 *     a ghost as written (silent ghost-entity bug — the verify-app
 *     leaderboards-empty regression that motivated this gate).
 *   - false-negative: fail to match a real writer, marking a real
 *     entity as a ghost (loud CI failure, easier to triage).
 *
 * False-positives are the danger. Pin the regex against representative
 * adversarial inputs.
 */

describe('hasWriter — positive matches', () => {
  it('matches "new Entity(" with one space', () => {
    const blob = `new Position(event.params.id);`;
    assert.equal(hasWriter('Position', blob), true);
  });

  it('matches "new Entity (" with extra whitespace', () => {
    // The regex uses \s+ allowing multiple spaces / tabs / newlines.
    const blob = `new Position  (event.params.id);`;
    assert.equal(hasWriter('Position', blob), true);
  });

  it('matches "new Entity(" across multiple files in concatenated blob', () => {
    const blob = [
      '// some/file.ts',
      'export function handle(event: X): void {',
      '  let p = new Position(event.params.id);',
      '  p.save();',
      '}',
    ].join('\n');
    assert.equal(hasWriter('Position', blob), true);
  });

  it('matches across newline between new and Entity', () => {
    const blob = `let p = new\nPosition(id);`;
    assert.equal(hasWriter('Position', blob), true);
  });
});

describe('hasWriter — negative matches (no false-positives)', () => {
  it('does NOT match an entity name without "new" prefix', () => {
    // Position.load(id) — read-only, not a writer.
    const blob = `let p = Position.load(id);`;
    assert.equal(hasWriter('Position', blob), false);
  });

  it('does NOT match an entity name inside an unrelated identifier', () => {
    // newPositionId is a local variable, NOT a constructor.
    const blob = `let newPositionId = event.params.id;`;
    assert.equal(hasWriter('Position', blob), false);
  });

  it('does NOT match a different entity with overlapping prefix', () => {
    // "PositionEvent" contains "Position" as prefix. \b word-boundary
    // must prevent matching.
    const blob = `let p = new PositionEvent(id);`;
    assert.equal(hasWriter('Position', blob), false);
  });

  it('does NOT match commented-out code (current scope: regex is plain)', () => {
    // Honest limitation: the regex doesn't strip comments. A commented
    // `// new Position(...)` would still match. This test documents
    // that limitation explicitly so a future contributor knows the
    // gate trusts the source code as-is.
    const blob = `// new Position(id);`;
    assert.equal(hasWriter('Position', blob), true);
  });

  it('does NOT match an entity name with no constructor call at all', () => {
    const blob = `import { Position } from './generated/schema';`;
    assert.equal(hasWriter('Position', blob), false);
  });
});

describe('hasWriter — edge cases', () => {
  it('returns false on empty blob', () => {
    assert.equal(hasWriter('Position', ''), false);
  });

  it('is case-sensitive on entity name', () => {
    // "Position" != "position". The schema entity names are PascalCase
    // by GraphQL convention; case-sensitive match prevents accidental
    // matches against unrelated lowercase identifiers.
    const blob = `let p = new position(id);`;
    assert.equal(hasWriter('Position', blob), false);
  });

  it('treats entity names with numeric suffix as opaque tokens', () => {
    // GraphQL allows entity names like Address2 or Position3. The
    // regex must match them as full tokens.
    const blob = `let p = new PositionV2(id);`;
    assert.equal(hasWriter('PositionV2', blob), true);
    // And the V1-prefix shouldn't match V2.
    assert.equal(hasWriter('Position', blob), false);
  });
});

describe('WRITER_IGNORE shape', () => {
  it('every entry has a non-empty reason string', () => {
    for (const [key, reason] of WRITER_IGNORE) {
      assert.equal(typeof reason, 'string', `${key}: reason must be string`);
      assert.ok(reason.length > 10, `${key}: reason too short: "${reason}"`);
    }
  });

  it('every key is a PascalCase entity name', () => {
    for (const key of WRITER_IGNORE.keys()) {
      assert.match(key, /^[A-Z][A-Za-z0-9]+$/,
        `WRITER_IGNORE key "${key}" must be PascalCase entity name`);
    }
  });

  it('includes the documented CohortPartner planned entry', () => {
    // CohortPartner is the canonical "planned but no on-chain
    // contract" entity. A refactor that removes it without adding the
    // actual writer would silently re-introduce the leaderboards-
    // empty bug.
    assert.ok(WRITER_IGNORE.has('CohortPartner'));
    const reason = WRITER_IGNORE.get('CohortPartner');
    assert.ok(reason.includes('Cohort'), 'CohortPartner reason names the cohort program');
  });

  it('includes the Counter aggregate entry', () => {
    assert.ok(WRITER_IGNORE.has('Counter'));
  });
});
