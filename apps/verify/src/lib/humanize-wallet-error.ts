/**
 * Shared wallet error humanization. Replaces per-hook humanizeOpenReason,
 * humanizeReason, humanizeIssueError with a single pattern-match.
 */
export function humanizeWalletError(error: unknown): { message: string; raw?: string } {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  // User rejection (EIP-1193 code 4001)
  if (/user rejected|user denied|4001/i.test(raw)) {
    return { message: 'Cancelled in wallet', raw };
  }

  // Insufficient gas
  if (/insufficient funds/i.test(raw)) {
    return { message: 'Not enough ETH for gas', raw };
  }

  // Nonce issues
  if (/nonce too low/i.test(raw)) {
    return { message: 'Stale tx — refresh and try again', raw };
  }

  // Contract revert with reason
  const revertMatch = raw.match(/execution reverted:\s*(.+)/i);
  if (revertMatch) {
    return { message: `Transaction reverted: ${revertMatch[1].slice(0, 100)}`, raw };
  }

  // WebAuthn errors
  if (/timed out|the operation either timed out/i.test(raw)) {
    return { message: 'Authenticator timed out — try again', raw };
  }
  if (/cancelled by the user|the operation was cancelled/i.test(raw)) {
    return { message: 'Authenticator cancelled', raw };
  }
  if (/not allowed|notallowederror/i.test(raw)) {
    return { message: 'Authenticator not allowed — check permissions', raw };
  }

  // App-specific codes
  if (raw === 'wallet_not_connected') return { message: 'Connect wallet first' };
  if (raw === 'coffer_not_deployed') return { message: 'Coffer is not deployed on this network' };
  if (raw === 'sigil_not_deployed') return { message: 'Sigil is not deployed on this network' };
  if (raw === 'router_not_deployed') return { message: 'Router is not deployed on this network' };
  if (raw === 'vigil_not_deployed') return { message: 'Vigil is not deployed on this network' };
  if (raw === 'kill_switch_not_deployed') return { message: 'Kill switch is not deployed on this network' };
  if (raw === 'invalid_amount') return { message: 'Enter a positive amount' };
  if (raw === 'invalid_size') return { message: 'Enter a positive size' };
  if (raw === 'nothing_to_revoke') return { message: 'No active mandates to revoke' };

  // Default
  if (raw.length > 0) {
    return { message: 'Something went wrong. Check your wallet.', raw };
  }
  return { message: 'Something went wrong. Check your wallet.' };
}
