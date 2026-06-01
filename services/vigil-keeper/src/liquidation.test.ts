import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { jobsToExecute, type QueuedJob } from './liquidation.js';

const job = (over: Partial<QueuedJob>): QueuedJob => ({
  jobId: 1n,
  user: '0x' + 'a'.repeat(40),
  deadlineBlock: 100n,
  isComplete: false,
  ...over,
});
const USER_A = '0x' + 'a'.repeat(40);
const USER_B = '0x' + 'b'.repeat(40);

/**
 * 083-BE10 regression. The keeper must EXECUTE already-queued jobs (Plinth
 * queues them in update_margin); it must never call queueLiquidation from the
 * keeper EOA (Vigil gates that to plinth_address -> Unauthorized revert).
 */
describe('jobsToExecute', () => {
  const paused = new Set([USER_A]);

  it('executes a deadline-reached, incomplete job for an underwater account', () => {
    expect(jobsToExecute([job({ jobId: 7n })], 100n, paused)).toEqual([7n]);
    expect(jobsToExecute([job({ jobId: 7n })], 150n, paused)).toEqual([7n]);
  });

  it('skips jobs whose deadline block has not been reached', () => {
    expect(jobsToExecute([job({ deadlineBlock: 200n })], 100n, paused)).toEqual([]);
  });

  it('skips already-complete jobs', () => {
    expect(jobsToExecute([job({ isComplete: true })], 100n, paused)).toEqual([]);
  });

  it('skips jobs whose user is not in the confirmed-underwater set', () => {
    expect(jobsToExecute([job({ user: USER_B })], 100n, paused)).toEqual([]);
  });

  it('de-duplicates repeated job ids', () => {
    expect(jobsToExecute([job({ jobId: 3n }), job({ jobId: 3n })], 100n, paused)).toEqual([3n]);
  });

  it('matches users case-insensitively', () => {
    const upper = USER_A.toUpperCase().replace('0X', '0x');
    expect(jobsToExecute([job({ user: upper })], 100n, paused)).toEqual([1n]);
  });
});

describe('vigil-keeper does not queue from the keeper EOA (083-BE10)', () => {
  it('tick.ts never calls queueLiquidation', () => {
    const src = readFileSync(path.resolve(process.cwd(), 'src', 'tick.ts'), 'utf8');
    // The keeper must never WRITE queueLiquidation (Plinth-only); it only
    // executes. (Comments may still reference the old bug by name.)
    expect(src).not.toMatch(/functionName:\s*['"]queueLiquidation['"]/);
    expect(src).toMatch(/functionName:\s*['"]executeLiquidation['"]/);
  });
});
