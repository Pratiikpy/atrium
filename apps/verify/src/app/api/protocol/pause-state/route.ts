import { NextResponse } from 'next/server';
import { gql } from '@/lib/scribe-helpers';

export const dynamic = 'force-dynamic';

/**
 * Pause state for a contract slug, read from the Scribe PauseState entities.
 *
 * QA fix (2026-06-02): the `useContractPaused` hook (used by /app/transfer and
 * the mobile vault panel) fetched this route, but it had never been created, so
 * every call 404'd and the hook silently fell back to `paused: false`. That made
 * the pause guard a no-op: a genuinely paused Aqueduct/Coffer/Plinth would still
 * read "not paused" in the UI. This route closes that by reading the real Scribe
 * singletons (the same entities the chaos pause/resume events write).
 *
 * Source of truth: Scribe AqueductPauseState / PlinthPauseState / CofferPauseState
 * (each a singleton, id "0"). vigil/sigil/router have no pause surface and no
 * indexed entity, so they return paused:false with an honest `not-indexed` label
 * rather than pretending to check. Scribe outage returns `pending`, never a fake.
 * The on-chain contract enforces pause regardless; this drives the UI banner only.
 */
type Slug = 'coffer' | 'plinth' | 'aqueduct' | 'vigil' | 'sigil' | 'router';
const INDEXED: Slug[] = ['coffer', 'plinth', 'aqueduct'];

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('contract') as Slug | null;
  if (!slug) {
    return NextResponse.json({ error: 'missing contract param' }, { status: 400 });
  }
  if (!INDEXED.includes(slug)) {
    return NextResponse.json({ paused: false, source: 'not-indexed' as const });
  }

  try {
    if (slug === 'aqueduct') {
      const d = await gql<{ aqueductPauseState: { isPaused: boolean } | null }>(
        `query { aqueductPauseState(id: "0") { isPaused } }`,
      );
      return NextResponse.json({
        paused: Boolean(d.aqueductPauseState?.isPaused),
        source: 'scribe' as const,
      });
    }
    if (slug === 'plinth') {
      const d = await gql<{ plinthPauseState: { isGloballyPaused: boolean } | null }>(
        `query { plinthPauseState(id: "0") { isGloballyPaused } }`,
      );
      return NextResponse.json({
        paused: Boolean(d.plinthPauseState?.isGloballyPaused),
        source: 'scribe' as const,
      });
    }
    // coffer: paused if EITHER deposits or withdrawals are paused.
    const d = await gql<{
      cofferPauseState: { isDepositsPaused: boolean; isWithdrawalsPaused: boolean } | null;
    }>(`query { cofferPauseState(id: "0") { isDepositsPaused isWithdrawalsPaused } }`);
    const s = d.cofferPauseState;
    return NextResponse.json({
      paused: Boolean(s && (s.isDepositsPaused || s.isWithdrawalsPaused)),
      depositsPaused: Boolean(s?.isDepositsPaused),
      withdrawalsPaused: Boolean(s?.isWithdrawalsPaused),
      source: 'scribe' as const,
    });
  } catch {
    // Scribe unreachable: honest pending, default not-paused (the chain still
    // enforces the real pause), never invent a state.
    return NextResponse.json({ paused: false, source: 'pending' as const });
  }
}
