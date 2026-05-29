/**
 * Auth session — Phase 3 (replaces Phase 2c stub).
 *
 * Reads the HMAC-signed `atrium-session` cookie set by /api/auth/verify.
 * Falls back to DEMO_WALLET_ADDRESS env for local dev without SIWE.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface Session {
  walletAddress: string;
}

function getSecret(): string | null {
  return process.env.ATRIUM_SESSION_SECRET ?? null;
}

function verifyToken(token: string): Session | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    const { data, sig } = decoded as { data: string; sig: string };
    const expected = createHmac('sha256', secret).update(data).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(data) as { walletAddress: string; expiresAt: number };
    if (Date.now() > payload.expiresAt) return null;
    return { walletAddress: payload.walletAddress };
  } catch {
    return null;
  }
}

export async function getSession(_req: Request): Promise<Session | null> {
  // Try cookie-based session first
  const cookieStore = await cookies();
  const token = cookieStore.get('atrium-session')?.value;
  if (token) {
    const session = verifyToken(token);
    if (session) return session;
  }
  // Demo fallback (single-wallet testnet demo model, per the founder's
  // "test everything with one wallet" decision). Audit fix (backend-api
  // #30/#53): this silently authenticated every request as the demo wallet
  // when no session cookie was present - acceptable for the shared testnet
  // demo, but it must be an explicit opt-out, not a silent fail-open. Set
  // ATRIUM_DEMO_MODE=0 (e.g. on a real/mainnet deploy) to require a real
  // SIWE session and return null instead.
  if (process.env.ATRIUM_DEMO_MODE === '0') return null;
  const addr = process.env.DEMO_WALLET_ADDRESS;
  if (!addr) return null;
  return { walletAddress: addr.toLowerCase() };
}

/**
 * Returns null if the session wallet matches requestedWallet.
 * Returns a 401 NextResponse if no session, 403 if mismatch.
 */
export async function requireWalletMatch(
  req: Request,
  requestedWallet: string,
): Promise<NextResponse | null> {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized', detail: 'No session' }, { status: 401 });
  }
  if (session.walletAddress !== requestedWallet.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden', detail: 'Wallet mismatch' }, { status: 403 });
  }
  return null;
}
