import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Server-side probe of the Codex worker /health. Never fakes "live". */

import { GET } from './route';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/codex/health', () => {
  it('source live + ok when the worker responds 2xx', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
    const j = await (await GET()).json();
    expect(j.ok).toBe(true);
    expect(j.source).toBe('live');
    expect(j.status).toBe(200);
  });

  it('source down when the worker responds non-2xx', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });
    const j = await (await GET()).json();
    expect(j.ok).toBe(false);
    expect(j.source).toBe('down');
  });

  it('source down + reason when the probe throws (no faked live)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error('x'), { name: 'TimeoutError' }));
    const j = await (await GET()).json();
    expect(j.ok).toBe(false);
    expect(j.source).toBe('down');
    expect(j.reason).toBe('TimeoutError');
  });
});
