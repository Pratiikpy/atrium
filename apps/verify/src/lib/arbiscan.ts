/**
 * Arbiscan link helpers.
 *
 * Per audit QQ-1: tx hashes from any source (wagmi receipt, Scribe-indexed
 * event, mock data, API echo) get interpolated into Arbiscan URLs across
 * the app, 6+ occurrences as of Wave-SS. A malformed hash injects path
 * components into the generated URL. Centralized validation:
 *   - regex-gate `^0x[0-9a-fA-F]{64}$` on every hash
 *   - return null when invalid so callers can short-circuit the link
 *     entirely rather than render a broken anchor
 *
 * Audit SS-1: extract + dedupe before adding any new caller.
 */

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Returns a validated Arbiscan tx URL, or null if the hash is malformed.
 * Default network is Arbitrum Sepolia (the only testnet Atrium ships on).
 */
export function arbiscanTxUrl(
  txHash: string | null | undefined,
  network: 'sepolia' | 'mainnet' = 'sepolia',
): string | null {
  if (typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) return null;
  const host = network === 'mainnet' ? 'arbiscan.io' : 'sepolia.arbiscan.io';
  return `https://${host}/tx/${txHash}`;
}

/** Convenience predicate for the same shape, useful in JSX conditionals. */
export function isValidTxHash(txHash: string | null | undefined): txHash is string {
  return typeof txHash === 'string' && TX_HASH_REGEX.test(txHash);
}

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Returns a validated Arbiscan address URL, or null if the address is
 * malformed. Same injection-guard rationale as the tx helper above; used by
 * the /docs/deployment transparency table.
 */
export function arbiscanAddressUrl(
  address: string | null | undefined,
  network: 'sepolia' | 'mainnet' = 'sepolia',
): string | null {
  if (typeof address !== 'string' || !ADDRESS_REGEX.test(address)) return null;
  const host = network === 'mainnet' ? 'arbiscan.io' : 'sepolia.arbiscan.io';
  return `https://${host}/address/${address}`;
}
