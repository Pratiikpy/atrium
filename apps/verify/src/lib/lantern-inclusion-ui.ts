/**
 * Pure UI-state helpers for the Lantern "Verify my balance" inclusion modal.
 *
 * Regression lock for the 2026-06-02 fix (commit ecbbcbb): when the attested
 * leaf tree has no IPFS CID (attestor running without WEB3_STORAGE), per-wallet
 * inclusion simply cannot be checked, no matter what address the user typed.
 * The pre-fix guard folded `!ipfsCid` into the same branch as a malformed
 * address, so a user who entered a perfectly valid 0x address was told their
 * address was invalid. These pure functions keep the unpinned-tree case
 * distinct (and checked FIRST) so the component can render an honest
 * not-pinned state and never misattribute the failure to user input.
 */

export type InclusionGuard = { ok: true } | { ok: false; reason: string };

export const NOT_PINNED_REASON =
  'The attested leaf tree is not pinned to IPFS yet, so per-wallet inclusion cannot be checked.';
export const INVALID_ADDRESS_REASON = 'Enter a valid 0x-prefixed wallet address.';

/** A tree is verifiable only once its leaves are pinned to IPFS (non-empty CID). */
export function isPinned(ipfsCid: string | null | undefined): boolean {
  return Boolean(ipfsCid && ipfsCid.length > 0);
}

/**
 * Decide whether an inclusion check can proceed. Pin state is checked BEFORE
 * the wallet so an unpinned tree never surfaces as an "invalid address" error.
 */
export function inclusionGuard(
  ipfsCid: string | null | undefined,
  wallet: string,
): InclusionGuard {
  if (!isPinned(ipfsCid)) return { ok: false, reason: NOT_PINNED_REASON };
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
    return { ok: false, reason: INVALID_ADDRESS_REASON };
  }
  return { ok: true };
}
