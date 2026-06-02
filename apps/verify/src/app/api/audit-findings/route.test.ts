import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Thin deserializer over the build-time public/audit-findings.json. */

const readFileMock = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ readFile: readFileMock }));

import { GET } from './route';

beforeEach(() => readFileMock.mockReset());

describe('GET /api/audit-findings', () => {
  it('returns the parsed register when the build JSON is present', async () => {
    const payload = {
      findings: [{ id: 1, finding: 'x', agent: 'a', location: 'l', owner: 'o', target: 't', status: 'closed' }],
      summary: { total: 1, closed: 1, pending: 0 },
      source: 'docs',
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    readFileMock.mockResolvedValue(JSON.stringify(payload));
    const j = await (await GET()).json();
    expect(j.source).toBe('docs');
    expect(j.summary.total).toBe(1);
    expect(j.findings).toHaveLength(1);
  });

  it('returns honest pending (not a silent empty) when the JSON is missing/corrupt', async () => {
    // Corrupt JSON in every candidate path -> JSON.parse throws inside the
    // route's per-candidate try -> falls through to the honest pending payload.
    readFileMock.mockResolvedValue('not valid json');
    const j = await (await GET()).json();
    expect(j.source).toBe('pending');
    expect(j.findings).toEqual([]);
    expect(j.summary).toEqual({ total: 0, closed: 0, pending: 0 });
  });
});
