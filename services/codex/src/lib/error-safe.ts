/**
 * Audit FIRE78-CODEX1 fix (sub-agent HIGH).
 *
 * Sub-agent finding: every route's catch block forwarded `(err as Error).message`
 * directly to the client in 503 responses. That string can contain stack
 * traces, env vars, Scribe URLs, or D1 query parameters. In production those
 * are secrets.
 *
 * This helper sanitizes the error for client consumption: only in dev mode
 * does the real message leak. The full error always gets logged server-side
 * so operators can debug.
 */
export type CodexEnv = { ENV?: string };

export function safeErrorDetail(err: unknown, env: CodexEnv): string {
  const e = err as Error;
  // Log full diagnostic always.
  console.error('Codex route error', e?.stack || e);
  // Return sanitized message to the caller.
  if (env?.ENV !== 'production') {
    return e?.message ?? 'unknown error';
  }
  return 'upstream unavailable';
}
