/**
 * Shared types for /app/tax, the jurisdiction enum mirrors the
 * `/api/tax/*` route gates (which accept only uk/us/eu/other).
 */
// Audit U-30 follow-up: the upstream Tablet service (services/tablet/
// src/main.py) accepts `Literal["uk", "us", "de"]` per its CSV exporters.
// Pre-U-30 the verify-app used `eu` here, which Tablet would reject with
// 422 once TABLET_URL was wired. The Germany FIFO § 23 EStG rule is
// specifically German, not EU-wide, so `de` is also the more accurate
// label. `other` stays for jurisdictions Tablet doesn't yet support.
export type TaxJurisdiction = 'uk' | 'us' | 'de' | 'other';
export type TaxYear = '2024' | '2025' | '2026';
