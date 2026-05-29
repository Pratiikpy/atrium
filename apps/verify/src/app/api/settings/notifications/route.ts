import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';

/**
 * GET/POST /api/settings/notifications
 *
 * Per-user notification channel preferences. Read by the notifier
 * service (Phase eta.5) to fan out alerts across Telegram / Discord
 * / email / custom webhook.
 *
 * Storage: Vercel KV free tier when ATRIUM_KV_REST_URL + ATRIUM_KV_REST_TOKEN
 * are set. Falls back to honest 503 when not configured (Year-1 deploy
 * may not have KV until founder provisions; UI shows "preferences
 * pending storage" until then).
 *
 * Auth (Phase theta.2 2026-05-25):
 * - Pre-fix this route had NO auth. Anyone with a wallet address could
 *   GET any user's prefs (Telegram chat ID, email, custom webhook URL)
 *   or POST overwrite them. PII + reputation-damage class.
 * - Now: both methods require `Authorization: Bearer <NOTIFIER_INTERNAL_KEY>`.
 *   The notifier service already holds this secret; the verify UI calls
 *   this route via a server action that injects the header. Direct
 *   browser-side fetches are out of scope until SIWE session lands —
 *   see human_left.md `notifier-prefs-siwe` for the deferred follow-up
 *   that swaps Bearer for wallet-signature auth on the user-facing path.
 */

import type {
  ChannelKind,
  AlertSeverity,
  AlertKind,
} from '../../../../../../../services/notifier/src/types';

interface UserPrefsBody {
  user: string;
  channels: Array<{
    kind: ChannelKind;
    enabled: boolean;
    telegramChatId?: string;
    discordWebhookUrl?: string;
    emailAddress?: string;
    customWebhookUrl?: string;
    minSeverity: AlertSeverity;
  }>;
  mutedKinds: AlertKind[];
}

export const dynamic = 'force-dynamic';

function kvUrl(): { url: string; token: string } | null {
  const url = process.env.ATRIUM_KV_REST_URL;
  const token = process.env.ATRIUM_KV_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function kvKey(user: string): string {
  return `notifier:prefs:${user.toLowerCase()}`;
}

/**
 * Bearer-token gate. Compares the `Authorization` header against
 * NOTIFIER_INTERNAL_KEY in constant time so a timing-side-channel
 * cannot leak the secret length. Returns null on success, a 401
 * NextResponse on failure (caller must early-return).
 *
 * Refuses to authenticate at all when NOTIFIER_INTERNAL_KEY is unset —
 * a missing secret is treated as fail-closed, never fail-open. The
 * notifier service has the same fail-closed contract on its side.
 */
function requireBearer(req: Request): NextResponse | null {
  // The notifier service reads `ATRIUM_INTERNAL_KEY` per
  // services/notifier/src/tick.ts:38; honor the same variable name on the
  // verify-app side so both ends of the wire share a single secret. The
  // legacy `NOTIFIER_INTERNAL_KEY` is accepted as a fallback for deploys
  // already configured under that name.
  const expected =
    process.env.ATRIUM_INTERNAL_KEY ?? process.env.NOTIFIER_INTERNAL_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: 'auth_not_configured', detail: 'ATRIUM_INTERNAL_KEY not set' },
      { status: 503 },
    );
  }
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const presented = header.slice('Bearer '.length).trim();
  if (!timingSafeEqual(presented, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

// Audit fix (#78): the prior hand-rolled comparator early-returned on a length
// mismatch, leaking whether the presented token matched the secret's length,
// and compared raw strings rather than fixed-length digests. Compare HMAC-SHA256
// digests instead - always 32 bytes, so the length check inside node's
// timingSafeEqual is non-revealing. Mirrors the audited-primitive pattern in
// auth-session.ts and sumsub/callback/route.ts.
function timingSafeEqual(a: string, b: string): boolean {
  const salt = 'atrium-bearer-compare';
  const da = createHmac('sha256', salt).update(a).digest();
  const db = createHmac('sha256', salt).update(b).digest();
  return cryptoTimingSafeEqual(da, db);
}

export async function GET(req: Request) {
  const authFail = requireBearer(req);
  if (authFail) return authFail;

  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  if (!user || !/^0x[0-9a-fA-F]{40}$/.test(user)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }
  const kv = kvUrl();
  if (!kv) {
    return NextResponse.json({
      user,
      channels: [],
      mutedKinds: [],
      source: 'pending' as const,
      note: 'Vercel KV not configured. Founder provisioning pending.',
    });
  }
  try {
    const r = await fetch(`${kv.url}/get/${kvKey(user)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (!r.ok) throw new Error(`kv_${r.status}`);
    const { result } = (await r.json()) as { result: string | null };
    if (!result) {
      return NextResponse.json({
        user,
        channels: [],
        mutedKinds: [],
        source: 'kv' as const,
      });
    }
    return NextResponse.json({
      ...(JSON.parse(result) as UserPrefsBody),
      source: 'kv' as const,
    });
  } catch (err) {
    return NextResponse.json({
      user,
      channels: [],
      mutedKinds: [],
      source: 'pending' as const,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(req: Request) {
  const authFail = requireBearer(req);
  if (authFail) return authFail;

  let body: UserPrefsBody;
  try {
    body = (await req.json()) as UserPrefsBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.user || !/^0x[0-9a-fA-F]{40}$/.test(body.user)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }
  if (!Array.isArray(body.channels) || !Array.isArray(body.mutedKinds)) {
    return NextResponse.json({ error: 'invalid_shape' }, { status: 400 });
  }

  const kv = kvUrl();
  if (!kv) {
    return NextResponse.json(
      { error: 'storage_not_configured', detail: 'Vercel KV pending founder provisioning' },
      { status: 503 },
    );
  }
  try {
    const r = await fetch(`${kv.url}/set/${kvKey(body.user)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(body) }),
    });
    if (!r.ok) throw new Error(`kv_${r.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'kv_write_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
