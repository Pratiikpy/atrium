#!/usr/bin/env node
// @ts-check
/**
 * Entity-writer coverage gate.
 *
 * Walks every `type X @entity` declaration in subgraph/schema.graphql, then
 * walks subgraph/src/**.ts for writers (`new X(` or `X.load(...)`). Reports
 * any entity with zero writers, those are "ghost entities" defined in the
 * schema but never produced by a handler. Queries against them silently
 * return empty arrays, which is exactly the verify-app leaderboards-always-
 * empty bug found in iteration 16.
 *
 * Different shape from the event-indexing gate (`check-event-indexing.mjs`):
 * that one asserts every emitted *event* has a handler. This one asserts
 * every defined *entity* has a producer. Together they pin both halves of
 * the indexer → schema → consumer chain.
 *
 * Exit codes:
 *   0  every entity has at least one writer, or it's on the WRITER_IGNORE
 *      allow-list with a one-line reason.
 *   1  ghost entities detected.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'subgraph', 'schema.graphql');
const HANDLERS_DIR = path.join(REPO_ROOT, 'subgraph', 'src');

// Entities deliberately not written (yet). Each entry: "EntityName" → one-line
// reason. Keep tight; the gate's value is forcing a decision per entity.
const WRITER_IGNORE = new Map([
  // Atrium's Cohort program is currently human-curated; no on-chain Cohort
  // contract exists in Year-1. See docs/MASTER_PLAN.md Section 8.1 for the
  // mainnet path. For testnet, /api/cohort/partners returns empty honestly.
  ['CohortPartner', 'deferred: on-chain Cohort contract is mainnet work (docs/MASTER_PLAN.md Section 8.1)'],
]);

const ENTITY_DECL_RE = /^type\s+(\w+)\s+@entity/gm;

async function* walk(dir, ext) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip generated AssemblyScript bindings, those are read-only mirrors
      // of the schema; the writers live in hand-written handler files.
      if (entry.name === 'generated' || entry.name === 'node_modules') continue;
      yield* walk(p, ext);
    } else if (entry.name.endsWith(ext)) {
      yield p;
    }
  }
}

async function collectEntities() {
  const text = await readFile(SCHEMA_PATH, 'utf8');
  const names = [];
  for (const match of text.matchAll(ENTITY_DECL_RE)) {
    names.push(match[1]);
  }
  return names;
}

async function collectWriters() {
  // Per-entity writer pattern set: any of `new <Name>(`, `<Name>.load(`,
  // `new <Name>\n  (`, etc. Build a single concatenation of all handler
  // files and grep for each entity name in writer position.
  let allText = '';
  for await (const file of walk(HANDLERS_DIR, '.ts')) {
    allText += '\n// ' + path.relative(REPO_ROOT, file) + '\n';
    allText += await readFile(file, 'utf8');
  }
  return allText;
}

function hasWriter(entityName, blob) {
  // `new Entity(` instantiates a fresh row.
  // `Entity.load(` reads an existing row (must follow with .save() to be
  // a meaningful writer, but load-only is also evidence the entity is
  // consumed in handler code, which means the schema is alive in some
  // sense). For ghost-entity purposes the conservative check is "any
  // reference in handler code at all" but that's too loose. We require
  // `new Entity(` because that's the unambiguous writer signal.
  const newCtor = new RegExp(`\\bnew\\s+${entityName}\\s*\\(`);
  return newCtor.test(blob);
}

async function main() {
  const entities = await collectEntities();
  const blob = await collectWriters();
  const written = [];
  const ignored = [];
  const ghosts = [];
  for (const name of entities) {
    if (hasWriter(name, blob)) {
      written.push(name);
    } else if (WRITER_IGNORE.has(name)) {
      ignored.push(name);
    } else {
      ghosts.push(name);
    }
  }
  console.log('entity-writer audit:');
  console.log(`  written:    ${written.length}`);
  console.log(`  ignored:    ${ignored.length} (per WRITER_IGNORE allow-list)`);
  console.log(`  GHOSTS:     ${ghosts.length}`);
  if (ghosts.length > 0) {
    console.log('\nghost entities, defined in schema.graphql but no `new Entity(` in subgraph/src/:');
    for (const name of ghosts) {
      console.log(`  ${name}`);
    }
    console.log('\nfix options:');
    console.log('  - add a `new Entity(...)` writer in the appropriate handler file');
    console.log('  - or, if intentional (e.g. populated by another subgraph), add to WRITER_IGNORE with a reason');
    process.exit(1);
  }
  console.log('\nevery entity has a writer.');
}

// Iter 79: export helpers for unit testing.
export { hasWriter, WRITER_IGNORE };

import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main().catch((err) => {
    console.error('check-entity-writers failed:', err);
    process.exit(2);
  });
}
