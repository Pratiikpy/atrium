import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Serves the latest k6 metrics. Audit #60: a no-runs-yet artifact and an
 * unreadable artifact must be DISTINGUISHABLE (different X-Atrium-Reason), so
 * operators don't read a read failure as "no load test has run".
 */

const readFileMock = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ readFile: readFileMock }));

import { GET } from './route';

beforeEach(() => readFileMock.mockReset());

describe('GET /api/loadtest/metrics', () => {
  it('returns the metrics array when the artifact has runs', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({
      generatedAt: 'x',
      metrics: [{ name: 'p95', unit: 'ms', p50: 1, p95: 2, p99: 3, budget: 5, source: 'k6' }],
    }));
    const r = await GET();
    const j = await r.json();
    expect(j).toHaveLength(1);
    expect(j[0].name).toBe('p95');
  });

  it('flags no-runs-yet when the artifact is present but empty', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ generatedAt: 'x', metrics: [] }));
    const r = await GET();
    expect(await r.json()).toEqual([]);
    expect(r.headers.get('X-Atrium-Source')).toBe('pending');
    expect(r.headers.get('X-Atrium-Reason')).toBe('no-runs-yet');
  });

  it('flags a corrupt/unreadable artifact distinctly from no-runs', async () => {
    // Corrupt JSON makes JSON.parse throw inside the route's try -> the catch
    // branch, which is the same "artifact unreadable" path as a read failure.
    readFileMock.mockResolvedValue('}{ not valid json');
    const r = await GET();
    expect(await r.json()).toEqual([]);
    expect(r.headers.get('X-Atrium-Reason')).toBe('no-loadtest-artifact');
  });
});
