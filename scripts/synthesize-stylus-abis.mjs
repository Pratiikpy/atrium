#!/usr/bin/env node
/**
 * Synthesize ABI files for Stylus contracts by parsing the sol! event
 * blocks in each contract's lib.rs. Real parameter names are required
 * because subgraph handlers dereference event.params.user, etc., and
 * generic arg0 names would fail typecheck.
 *
 * Why this script exists: the Stylus contracts can't build under Rust 1.92
 * (stylus-sdk 0.6 const-eval bug — see STYLUS_MIGRATION_PLAN.md), so the
 * normal ABI extraction path returns empty. The source files are then the
 * next-most-authoritative spec for what events exist.
 *
 * After the Stylus migration ships, scripts/extract-abis.mjs becomes
 * authoritative — its output replaces these stubs with the full ABI.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STYLUS_CONTRACTS = [
  { name: 'Plinth', src: 'contracts/plinth/src/lib.rs' },
  { name: 'Coffer', src: 'contracts/coffer/src/lib.rs' },
  { name: 'Sigil', src: 'contracts/sigil/src/lib.rs' },
  { name: 'Vigil', src: 'contracts/vigil/src/lib.rs' },
];

const ABI_DIR = join(process.cwd(), 'subgraph', 'abis');

function parseSolEvents(source) {
  const events = [];
  const startRe = /sol!\s*\{/g;
  let m;
  while ((m = startRe.exec(source)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    const block = source.slice(start, i - 1);
    const evtRe = /event\s+([A-Z][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*;/g;
    let em;
    while ((em = evtRe.exec(block)) !== null) {
      events.push({ name: em[1], paramsRaw: em[2] });
    }
  }
  return events;
}

function parseParams(raw) {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  const parts = splitTopLevelCommas(trimmed);
  return parts.map((p, i) => {
    const tokens = p.trim().split(/\s+/);
    let indexed = false;
    let type;
    let name = `arg${i}`;
    if (tokens[0] === 'indexed') {
      indexed = true;
      type = tokens[1];
      if (tokens.length >= 3) name = tokens[2];
    } else {
      type = tokens[0];
      if (tokens.length >= 2 && tokens[1] === 'indexed') {
        indexed = true;
        if (tokens.length >= 3) name = tokens[2];
      } else if (tokens.length >= 2) {
        name = tokens[1];
      }
    }
    return { name, type, indexed, internalType: type };
  });
}

function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.length) out.push(buf);
  return out;
}

let totalEvents = 0;
for (const c of STYLUS_CONTRACTS) {
  const source = await readFile(join(process.cwd(), c.src), 'utf8');
  const events = parseSolEvents(source);
  const abi = events.map((e) => ({
    anonymous: false,
    inputs: parseParams(e.paramsRaw),
    name: e.name,
    type: 'event',
  }));
  await writeFile(join(ABI_DIR, `${c.name}.json`), JSON.stringify(abi, null, 2) + '\n', 'utf8');
  console.log(`  ${c.name.padEnd(8)} ${abi.length.toString().padStart(2)} event(s) (with real param names)`);
  totalEvents += abi.length;
}
console.log(`synthesized ${totalEvents} events across ${STYLUS_CONTRACTS.length} Stylus contracts from source`);
