import { NextRequest, NextResponse } from 'next/server';
import { safeErrorDetail } from '@/lib/safe-error';

/**
 * POST /api/chaos/inject
 *
 * Triggers a chaos fault on the testnet stack. The fault is picked from
 * a whitelisted enum; the injection sends a real instruction to the Praetor
 * chaos agent which simulates the fault, observes recovery, and returns a
 * log entry.
 *
 * Wave 1: this route forwards to the Praetor chaos agent at PRAETOR_CHAOS_URL.
 * Until the agent is deployed (Month 9 per ROADMAP.md), the route returns 503
 * honestly — no fake "success" response.
 */
const VALID_FAULTS = [
  'oracle_drift',
  'keeper_offline',
  'partial_fill',
  'gas_spike',
  'indexer_stall',
] as const;
type Fault = (typeof VALID_FAULTS)[number];

interface Body {
  fault?: Fault;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.fault || !VALID_FAULTS.includes(body.fault)) {
    return NextResponse.json(
      { error: 'invalid_fault', detail: `Must be one of: ${VALID_FAULTS.join(', ')}` },
      { status: 400 }
    );
  }

  const chaosUrl = process.env.PRAETOR_CHAOS_URL;
  if (!chaosUrl) {
    return NextResponse.json(
      {
        error: 'chaos_agent_not_deployed',
        detail:
          'PRAETOR_CHAOS_URL not configured. The Praetor chaos agent deploys in Month 9 per docs/ROADMAP.md.',
      },
      { status: 503 }
    );
  }

  try {
    const r = await fetch(`${chaosUrl}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fault: body.fault }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: 'agent_error', status: r.status },
        { status: 502 }
      );
    }
    const result = await r.json();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'agent_unreachable', detail: safeErrorDetail(err) },
      { status: 503 }
    );
  }
}
