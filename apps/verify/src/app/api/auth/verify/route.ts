import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SiweMessage } from 'siwe';
import { createHmac } from 'node:crypto';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

export const dynamic = 'force-dynamic';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getSecret(): string {
  const s = process.env.ATRIUM_SESSION_SECRET;
  if (!s) throw new Error('ATRIUM_SESSION_SECRET not set');
  return s;
}

function signSession(payload: { walletAddress: string; expiresAt: number }): string {
  const data = JSON.stringify(payload);
  const sig = createHmac('sha256', getSecret()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}

export async function POST(req: NextRequest) {
  let body: { message: string; signature: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const nonce = cookieStore.get('atrium-nonce')?.value;
  if (!nonce) {
    return NextResponse.json({ ok: false, error: 'nonce_expired' }, { status: 401 });
  }

  // SIWE binding to THIS host. Without these checks a signature created for
  // a different domain (phishing site, evil clone) could be replayed against
  // Atrium. Trusted host comes from ATRIUM_AUTH_HOST (e.g. 'useatrium.me');
  // falls back to the request's Host header in dev where the env isn't set.
  const expectedHost = (process.env.ATRIUM_AUTH_HOST ?? req.headers.get('host') ?? '').toLowerCase();
  if (!expectedHost) {
    return NextResponse.json({ ok: false, error: 'host_unknown' }, { status: 500 });
  }
  const proto = req.headers.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const expectedUriPrefix = `${proto}://${expectedHost}`;

  try {
    const siweMessage = new SiweMessage(body.message);

    // Reject if the message itself claims a different domain/uri than ours.
    if (siweMessage.domain.toLowerCase() !== expectedHost) {
      return NextResponse.json({ ok: false, error: 'domain_mismatch' }, { status: 401 });
    }
    if (!siweMessage.uri.toLowerCase().startsWith(expectedUriPrefix.toLowerCase())) {
      return NextResponse.json({ ok: false, error: 'uri_mismatch' }, { status: 401 });
    }
    // Bind the signed message's nonce to the one we issued (single-use, in the
    // httpOnly cookie). Stops a signature minted with a stale/foreign nonce.
    if (siweMessage.nonce !== nonce) {
      return NextResponse.json({ ok: false, error: 'nonce_mismatch' }, { status: 401 });
    }
    // Honour the SIWE message's own validity window if present.
    const now = Date.now();
    if (siweMessage.expirationTime && Date.parse(siweMessage.expirationTime) < now) {
      return NextResponse.json({ ok: false, error: 'message_expired' }, { status: 401 });
    }
    if (siweMessage.notBefore && Date.parse(siweMessage.notBefore) > now) {
      return NextResponse.json({ ok: false, error: 'message_not_yet_valid' }, { status: 401 });
    }

    // Verify the signature. viem's verifyMessage handles BOTH a plain EOA
    // (ecrecover) AND an EIP-1271 smart-contract wallet (the Postern passkey
    // account) by calling the account's isValidSignature on-chain, plus
    // EIP-6492 for not-yet-deployed accounts. The siwe library's own verify()
    // is EOA-only, which is why a Postern user could never sign in before.
    // We have already validated domain/uri/nonce/expiry above, so this call is
    // strictly the cryptographic check.
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com';
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
    const valid = await client.verifyMessage({
      address: siweMessage.address as `0x${string}`,
      message: siweMessage.prepareMessage(),
      signature: body.signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 401 });
    }

    const walletAddress = siweMessage.address.toLowerCase();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = signSession({ walletAddress, expiresAt });

    cookieStore.delete('atrium-nonce');
    cookieStore.set('atrium-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60, // 24h
    });

    return NextResponse.json({ ok: true, walletAddress });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'siwe_error', detail: err instanceof Error ? err.message : String(err) },
      { status: 401 },
    );
  }
}
