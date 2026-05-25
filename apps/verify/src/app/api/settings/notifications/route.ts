import { NextResponse } from 'next/server';

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
 * Auth: GET requires wallet param matching the requester (verified
 * via header binding once wallet-session is wired). POST same.
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

export async function GET(req: Request) {
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
