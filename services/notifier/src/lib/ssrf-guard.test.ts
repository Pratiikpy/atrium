import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertPublicHttps, SsrfError } from './ssrf-guard.js';

// Mock dns/promises
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

import { lookup } from 'node:dns/promises';
const mockLookup = vi.mocked(lookup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertPublicHttps', () => {
  it('rejects http:// (HTTPS required)', async () => {
    await expect(assertPublicHttps('http://example.com')).rejects.toThrow(SsrfError);
    await expect(assertPublicHttps('http://example.com')).rejects.toMatchObject({ code: 'webhook_https_required' });
  });

  it('rejects https://127.0.0.1 (loopback)', async () => {
    await expect(assertPublicHttps('https://127.0.0.1')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });

  it('rejects https://10.0.0.5 (RFC1918)', async () => {
    await expect(assertPublicHttps('https://10.0.0.5')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });

  it('rejects https://169.254.169.254 (AWS metadata)', async () => {
    await expect(assertPublicHttps('https://169.254.169.254')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });

  it('rejects https://[::1] (IPv6 loopback)', async () => {
    await expect(assertPublicHttps('https://[::1]')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });

  it('accepts https://api.example.com resolving to public IP', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);
    const result = await assertPublicHttps('https://api.example.com');
    expect(result.hostname).toBe('api.example.com');
  });

  it('rejects hostname resolving to private IP', async () => {
    mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }] as any);
    await expect(assertPublicHttps('https://internal.example.com')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });

  it('rejects CGNAT range 100.64.x.x', async () => {
    mockLookup.mockResolvedValue([{ address: '100.64.0.1', family: 4 }] as any);
    await expect(assertPublicHttps('https://cgnat.example.com')).rejects.toMatchObject({ code: 'webhook_private_ip' });
  });
});
