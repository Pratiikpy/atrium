import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

/**
 * Returns the wallet address bound to the current session cookie, or null.
 * The client (SessionSync) uses this to decide whether a connected wallet
 * still needs to run the SIWE sign-in handshake. Read-only, never throws.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  return NextResponse.json({ walletAddress: session?.walletAddress ?? null });
}
