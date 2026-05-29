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
  // "test everything with one wallet" decision).
  //
  // Audit fix (backend-api #30/#53), corrected after adversarial review: the
  // first pass made this an opt-OUT (ATRIUM_DEMO_MODE=0), which is still
  // fail-OPEN by default - a production deploy with DEMO_WALLET_ADDRESS set but
  // the flag forgotten would silently authenticate every anonymous caller as
  // the demo wallet (the exact footgun the finding warns about). It is now
  // fail-CLOSED in production: the demo fallback only ever fires when NOT in
  // production, OR when an operator has EXPLICITLY opted in with
  // ATRIUM_ALLOW_DEMO_SESSION=true. So a misconfigured prod env can never
  // fabricate a session. Local dev + vitest (NODE_ENV !== 'production') keep
  // the single-wallet convenience.
  const inProduction = process.env.NODE_ENV === 'production';
  const demoOptIn = process.env.ATRIUM_ALLOW_DEMO_SESSION === 'true';
  if (inProduction && !demoOptIn) return null;
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
