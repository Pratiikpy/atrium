/**
 * x402 configuration — Codex pay-to address (Phase 6, FULL_AUDIT #49).
 *
 * Reads CODEX_PAY_TO_ADDRESS from environment (Doppler-managed).
 * Fails loudly at import time if not set, preventing the service from
 * starting in a broken state where every request would 503.
 */

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export function loadPayToAddress(env: Record<string, string | undefined>): string {
  const addr = env.CODEX_PAY_TO_ADDRESS;
  if (!addr || addr.trim() === '' || addr === 'REPLACE_BEFORE_PRODUCTION_DEPLOY') {
    throw new Error(
      '[codex] FATAL: CODEX_PAY_TO_ADDRESS is not configured. ' +
        'Set it in Doppler (atrium-staging/atrium-prod codex config) to a ' +
        'Coffer-deposit-derived address controlled by Praetor. ' +
        'Refusing to start — every x402 payment would fail.',
    );
  }
  if (!ADDRESS_REGEX.test(addr)) {
    throw new Error(
      `[codex] FATAL: CODEX_PAY_TO_ADDRESS="${addr}" is not a valid 0x address.`,
    );
  }
  return addr;
}
