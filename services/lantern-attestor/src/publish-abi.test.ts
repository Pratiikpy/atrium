import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase theta audit follow-up (2026-05-25).
 *
 * The lantern-attestor service has two copies of publishOnce: src/ and
 * api/_ (the Vercel deploy bundler can only see files under api/, so
 * helpers there get an underscore prefix per the Vercel convention).
 * These two files duplicate the LANTERN_ABI constant. When the contract
 * gained leafCount + ipfsCid in Phase zeta.1, only api/_publish-once.ts
 * was updated. src/publish-once.ts kept the 3-arg shape until this
 * audit pass caught it.
 *
 * This test reads both files as text and asserts that their ABI shape
 * matches the deployed Solidity signature in
 * contracts/lantern-attestor/src/LanternAttestor.sol. A future contract
 * extension (adding a 6th arg, renaming `ipfsCid`, etc.) needs to land
 * in BOTH .ts files OR this test fails loudly.
 *
 * Same shape as apps/verify/src/lib/verifier-hooks-contract.test.ts —
 * pin the function-name selectors against the contract so a regression
 * fails CI before it reaches a live tx that reverts on chain.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SRC = join(REPO_ROOT, 'services/lantern-attestor/src/publish-once.ts');
const API = join(REPO_ROOT, 'services/lantern-attestor/api/_publish-once.ts');
const SOL = join(REPO_ROOT, 'contracts/lantern-attestor/src/LanternAttestor.sol');

const EXPECTED_ARGS = [
  { name: 'root', type: 'bytes32' },
  { name: 'block_number', type: 'uint256' },
  { name: 'leafCount', type: 'uint256' },
  { name: 'ipfsCid', type: 'string' },
  { name: 'signature', type: 'bytes' },
];

function assertContainsArg(file: string, arg: { name: string; type: string }) {
  const text = readFileSync(file, 'utf8');
  // The ABI is a TypeScript object literal in the file; the inputs array
  // includes lines like `{ name: 'root', type: 'bytes32' }`. We grep for
  // both name + type tokens on the same line so a future field reorder
  // doesn't silently slip past.
  const pattern = new RegExp(
    `name:\\s*['"\`]${arg.name}['"\`].*type:\\s*['"\`]${arg.type}['"\`]`,
  );
  expect(text, `${file} ABI missing ${arg.name}: ${arg.type}`).toMatch(pattern);
}

describe('LanternAttestor.publish ABI parity', () => {
  it('contract signature matches the 5-arg shape we expect', () => {
    const sol = readFileSync(SOL, 'utf8');
    // The Solidity source declares the function:
    //   function publish(
    //       bytes32 root,
    //       uint256 block_number,
    //       uint256 leafCount,
    //       string calldata ipfsCid,
    //       bytes calldata /*signature*/
    //   ) external
    expect(sol).toContain('function publish(');
    expect(sol).toMatch(/bytes32\s+root/);
    expect(sol).toMatch(/uint256\s+block_number/);
    expect(sol).toMatch(/uint256\s+leafCount/);
    expect(sol).toMatch(/string\s+calldata\s+ipfsCid/);
    expect(sol).toMatch(/bytes\s+calldata/);
  });

  it('src/publish-once.ts ABI matches the contract', () => {
    for (const arg of EXPECTED_ARGS) {
      assertContainsArg(SRC, arg);
    }
  });

  it('api/_publish-once.ts ABI matches the contract', () => {
    for (const arg of EXPECTED_ARGS) {
      assertContainsArg(API, arg);
    }
  });

  it('both files pass the same args in the writeContract call', () => {
    const src = readFileSync(SRC, 'utf8');
    const api = readFileSync(API, 'utf8');
    // The writeContract call must reference root, blockNumber, a leaf-
    // count expression, an ipfsCid expression, and the signature. We
    // don't pin exact identifier names — both files use slightly
    // different locals (leafCountArg vs leafCountForEvent) — but the
    // function name + 5-arg shape is mandatory.
    expect(src).toMatch(/functionName:\s*['"`]publish['"`]/);
    expect(api).toMatch(/functionName:\s*['"`]publish['"`]/);
    // Five args expected in each writeContract call.
    const srcArgs = src.match(/args:\s*\[([^\]]+)\]/);
    const apiArgs = api.match(/args:\s*\[([^\]]+)\]/);
    expect(srcArgs, 'src/publish-once.ts has no writeContract args[] tuple').not.toBeNull();
    expect(apiArgs, 'api/_publish-once.ts has no writeContract args[] tuple').not.toBeNull();
    // Count the commas to estimate arity. 5 args = 4 commas at top
    // level. We allow whitespace + identifier per slot.
    const countTopLevelCommas = (s: string) => {
      let depth = 0;
      let n = 0;
      for (const ch of s) {
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ',' && depth === 0) n++;
      }
      return n;
    };
    expect(countTopLevelCommas(srcArgs![1]), 'src args tuple must have 5 elements').toBe(4);
    expect(countTopLevelCommas(apiArgs![1]), 'api args tuple must have 5 elements').toBe(4);
  });
});
