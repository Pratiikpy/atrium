/**
 * Sanitize a free-text amount input to a valid decimal string.
 *
 * The amount fields across the app (trade, transfer, top-up) are `type="text"`
 * so the regex is load-bearing (browsers do not validate text inputs). The
 * prior inline sanitizer `replace(/[^0-9.]/g, '')` stripped letters and the
 * minus sign but ALLOWED multiple decimal points: "1.2.3" passed through
 * unchanged (an invalid number). Downstream parsing is NaN-safe, so nothing
 * broke, but the field accepted a value the user can never submit. This keeps
 * only the first decimal point so the field never holds an invalid number.
 *
 * Keeps: digits and a single dot. Strips: letters, sign, whitespace, commas,
 * and any decimal point after the first.
 */
export function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  // keep everything up to and including the first dot, drop later dots
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}
