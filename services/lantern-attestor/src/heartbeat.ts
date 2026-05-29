/**
 * Honeybadger heartbeat ping — Phase 12 observability.
 * Called at the start of every tick to signal liveness.
 */
export async function heartbeat(name: string): Promise<void> {
  const url = process.env.HONEYBADGER_HEARTBEAT_URL?.replace('<NAME>', name);
  if (!url) return;
  await fetch(url, { method: 'POST', signal: AbortSignal.timeout(2000) }).catch(() => {});
}
