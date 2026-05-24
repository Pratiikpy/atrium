/**
 * Thin Codex client. The 3 reference agents (Augur, Haruspex, Auspex)
 * pull price + venue health from Codex /v1/*. Codex is x402-paywalled
 * for `/v1/margin`, `/v1/positions`, `/v1/risk`, etc., but `/health` is
 * free for liveness probing.
 *
 * For the buildathon demo we probe /health each tick to prove the
 * Codex ↔ agent pipeline is alive; price feeds will switch on once
 * Codex's data routes are wired with real Plinth-derived series.
 */

const TIMEOUT_MS = 5_000;

export async function codexHealth(codexUrl: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const r = await fetch(`${codexUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: r.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
