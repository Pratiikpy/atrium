import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const checkScribeHealth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/scribe-health', () => ({ checkScribeHealth }));

import { GET } from './route';

beforeEach(() => {
  checkScribeHealth.mockReset();
  vi.stubEnv('SCRIBE_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/scribe/health', () => {
  it('503 when SCRIBE_URL is not configured', async () => {
    const r = await GET();
    expect(r.status).toBe(503);
  });

  it('returns the health payload when configured', async () => {
    vi.stubEnv('SCRIBE_URL', 'https://scribe.example');
    checkScribeHealth.mockResolvedValue({ indexedBlock: 100, head: 101, lag: 1, stale: false });
    const j = await (await GET()).json();
    expect(j.indexedBlock).toBe(100);
    expect(j.stale).toBe(false);
  });

  it('503 health_check_failed when the probe throws', async () => {
    vi.stubEnv('SCRIBE_URL', 'https://scribe.example');
    checkScribeHealth.mockRejectedValue(new Error('down'));
    const r = await GET();
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('health_check_failed');
  });
});
