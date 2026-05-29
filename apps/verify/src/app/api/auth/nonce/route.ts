import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nonce = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('atrium-nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 min TTL
  });
  return NextResponse.json({ nonce });
}
