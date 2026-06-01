import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

/**
 * Iter 68 audit fix: locks LL-3 + LL-5 fixes on /api/tax/allowance.
 *
 * - LL-3: pre-fix `parseInt(year, 10)` without validation. NaN year
 *   rendered as "NaN/N CGT allowance" in the UI. Fix: strict /^\d{4}$/
 *   regex then range gate [2020, 2099].
 * - LL-5: usedUsd was hardcoded to "$0" with source:pending. A
 *   downstream reader that ignored `source` would render the literal
 *   "$0" as a real measurement. Fix: null per real-data discipline.
 */

function makeRequest(query: string): NextRequest {
  const url = `http://localhost/api/tax/allowance${query ? '?' + query : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/tax/allowance, UK default', () => {
  it('returns UK allowance labels by default', async () => {
    const json = await (await GET(makeRequest(''))).json();
    expect(json.jurisdictionLabel).toBe('2026/27 CGT allowance · UK');
    expect(json.yearLabel).toBe('2026');
  });

  it('renders £3000 GBP × 1.27 USD = $3,810 total', async () => {
    const json = await (await GET(makeRequest(''))).json();
    // 3000 * 1.27 = 3810. Locale formatted: "$3,810".
    expect(json.totalUsd).toBe('$3,810');
    expect(json.remainingUsd).toBe('$3,810');
  });

  it('LL-5: returns usedUsd:null + pctUsed:null (NOT $0 / 0%)', async () => {
    const json = await (await GET(makeRequest(''))).json();
    expect(json.usedUsd).toBeNull();
    expect(json.pctUsed).toBeNull();
    expect(json.source).toBe('pending');
  });
});

describe('GET /api/tax/allowance, non-UK jurisdictions', () => {
  it('returns US "no equivalent exemption" label + all-null fields', async () => {
    const json = await (await GET(makeRequest('jurisdiction=us'))).json();
    expect(json.jurisdictionLabel).toBe('US · no equivalent exemption');
    expect(json.usedUsd).toBeNull();
    expect(json.remainingUsd).toBeNull();
    expect(json.totalUsd).toBeNull();
    expect(json.pctUsed).toBeNull();
    expect(json.source).toBe('pending');
  });

  it('U-30: returns DE FIFO label for de (was eu pre-U-30)', async () => {
    const json = await (await GET(makeRequest('jurisdiction=de'))).json();
    expect(json.jurisdictionLabel).toBe('DE FIFO · no exemption');
  });

  it('U-30: rejects the old eu key, falls back to UK', async () => {
    // Pre-U-30 (audit U-13) the enum accepted `eu`. Tablet's exporter
    // is specifically German FIFO § 23 EStG, NOT EU-wide, so `de` is
    // the right canonical key. Old `eu` strings now fall back to UK.
    const json = await (await GET(makeRequest('jurisdiction=eu'))).json();
    expect(json.jurisdictionLabel).toBe('2026/27 CGT allowance · UK');
  });

  it('falls back to UK on invalid jurisdiction', async () => {
    const json = await (await GET(makeRequest('jurisdiction=evilcorp'))).json();
    expect(json.jurisdictionLabel).toBe('2026/27 CGT allowance · UK');
  });
});

describe('GET /api/tax/allowance, LL-3 year validation', () => {
  it('rejects non-4-digit year (falls back to 2026)', async () => {
    const json = await (await GET(makeRequest('year=abc'))).json();
    expect(json.yearLabel).toBe('2026');
    expect(json.jurisdictionLabel).toBe('2026/27 CGT allowance · UK');
  });

  it('rejects 5-digit year (falls back to 2026)', async () => {
    const json = await (await GET(makeRequest('year=20266'))).json();
    expect(json.yearLabel).toBe('2026');
  });

  it('rejects out-of-range year < 2020 (falls back to 2026)', async () => {
    const json = await (await GET(makeRequest('year=1999'))).json();
    expect(json.yearLabel).toBe('2026');
  });

  it('rejects out-of-range year > 2099 (falls back to 2026)', async () => {
    const json = await (await GET(makeRequest('year=2100'))).json();
    expect(json.yearLabel).toBe('2026');
  });

  it('accepts valid year and renders the rolling YY/YY+1 label', async () => {
    const json = await (await GET(makeRequest('year=2030'))).json();
    expect(json.yearLabel).toBe('2030');
    expect(json.jurisdictionLabel).toBe('2030/31 CGT allowance · UK');
  });

  it('wraps the YY-suffix at century boundary (2099 → 99/00)', async () => {
    const json = await (await GET(makeRequest('year=2099'))).json();
    // (2099 + 1) % 100 = 0 → padStart "00".
    expect(json.jurisdictionLabel).toBe('2099/00 CGT allowance · UK');
  });
});
