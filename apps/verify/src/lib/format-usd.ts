/**
 * BigInt-native money formatting. Pinned by unit tests so audits S-1,
 * T-4, and U-36 cannot regress.
 *
 * Audit S-1: USDC has 6 decimals; Coffer is ERC-4626 over USDC so share
 *            decimals = asset decimals = 6 (NOT 18). A previous bug used
 *            `convertToAssets(10n ** 18n)` for the share price, which on
 *            USDC produced share prices in the trillions.
 *
 * Audit T-4: pre-fix routes did `Number(big) / 1e6` which loses precision
 *            past `Number.MAX_SAFE_INTEGER` (~$9B at micro-USDC scale).
 *
 * Audit U-36: the prior fix used `parseFloat(formatUnits(big, decimals))`
 *            which STILL round-trips through Number, past ~$10^15 sub-
 *            cent precision drops, sub-cent values truncate to $0.00,
 *            negatives render as "$-100.00" not "-$100.00". The current
 *            implementation is BigInt-native:
 *              - exact precision at any scale (no parseFloat coercion)
 *              - sub-cent values render at their actual value when the
 *                callsite picks more display decimals
 *              - negatives render as "-$100.00" (conventional form)
 *
 * All three helpers accept the raw on-chain BigInt + the asset's decimal
 * count. Callers MUST pass the correct decimals, USDC is 6, ETH-like is 18.
 */

/**
 * Core formatter. Splits a BigInt into integer + fractional parts using
 * BigInt arithmetic only, rounds the fractional part to `displayDecimals`
 * digits with banker-neutral half-up rounding, applies thousands
 * separators to the integer part.
 *
 * `displayDecimals` ≤ `decimals`, the function rounds down to fewer
 * display digits. `displayDecimals > decimals` is supported (pads with
 * trailing zeros).
 *
 * Returns the unprefixed numeric string with sign baked in:
 *   formatBigDecimal(123_456_789n, 6, 2) → "123.46"
 *   formatBigDecimal(-100_000_000n, 6, 2) → "-100.00"
 */
function formatBigDecimal(amountWei: bigint, decimals: number, displayDecimals: number): string {
  const negative = amountWei < 0n;
  const abs = negative ? -amountWei : amountWei;
  const sign = negative ? '-' : '';

  const divisor = 10n ** BigInt(decimals);
  const intPartRaw = abs / divisor;
  const fracPartRaw = abs % divisor;

  let intPart: bigint;
  let displayFrac: bigint;
  if (displayDecimals >= decimals) {
    // Pad with trailing zeros, no rounding needed.
    intPart = intPartRaw;
    displayFrac = fracPartRaw * 10n ** BigInt(displayDecimals - decimals);
  } else {
    // Round half-up: add half a "displayDecimals digit" before division.
    const cutoff = 10n ** BigInt(decimals - displayDecimals);
    const half = cutoff / 2n;
    const adjusted = fracPartRaw + half;
    intPart = intPartRaw + adjusted / divisor;
    displayFrac = (adjusted % divisor) / cutoff;
    // After carry, if displayFrac somehow >= 10^displayDecimals, normalize.
    const cap = 10n ** BigInt(displayDecimals);
    if (displayFrac >= cap) {
      intPart += 1n;
      displayFrac = 0n;
    }
  }

  // Thousands separator on the integer part. JavaScript regex on the
  // string representation is the standard trick, at this scale (<10^60)
  // performance is irrelevant.
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracStr = displayFrac.toString().padStart(displayDecimals, '0');

  return `${sign}${intStr}${displayDecimals > 0 ? '.' + fracStr : ''}`;
}

/** Format a USD amount: "$1,234.56" with thousands separators and 2 decimals.
 *  Negatives render as "-$100.00" (the sign sits outside the dollar sign,
 *  matching the conventional US currency format). */
export function formatUsd(amountWei: bigint, decimals: number): string {
  const body = formatBigDecimal(amountWei, decimals, 2);
  // Move the sign outside the dollar sign, "-100.00" → "-$100.00".
  if (body.startsWith('-')) {
    return `-$${body.slice(1)}`;
  }
  return `$${body}`;
}

/** Format a token-share amount: "1,234.56" without the $ prefix. */
export function formatShares(amountWei: bigint, decimals: number): string {
  return formatBigDecimal(amountWei, decimals, 2);
}

/** Format an ERC-4626 share price: "$1.0050" with 4 decimals of precision. */
export function formatSharePrice(amountWei: bigint, decimals: number): string {
  const body = formatBigDecimal(amountWei, decimals, 4);
  if (body.startsWith('-')) {
    return `-$${body.slice(1)}`;
  }
  return `$${body}`;
}
