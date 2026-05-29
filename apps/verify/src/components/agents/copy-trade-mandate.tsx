'use client';

import { useSearchParams } from 'next/navigation';
import { NewMandateButton, type MandatePrefill } from '@/components/agents/new-mandate-button';

/**
 * Audit fix (#50): the marketplace profile ("Copy {agent} with recommended
 * caps") and the Rostrum leaderboard "Delegate" link both navigate to
 * /app/agents?copy=<agent>, but nothing read the param - the funnel dead-ended
 * on an empty mandate form. This wrapper reads ?copy, resolves it to the
 * agent's recommended caps, and renders a NewMandateButton that auto-opens
 * prefilled. Unmatched / absent param falls back to the normal button.
 *
 * The profile passes ?copy=<id> ("augur"); the leaderboard passes ?copy=<ens>
 * ("augur.eth"). We normalize both (strip ".eth", lowercase) before matching.
 *
 * Caps mirror the marketplace AGENTS recommendedCaps (apps/verify/src/app/
 * agents/marketplace/[id]/page.tsx). Kept as a small local map rather than
 * importing the server-component page into this client component.
 */
const RECOMMENDED_CAPS: Record<string, { label: string; caps: MandatePrefill }> = {
  augur: { label: 'Augur', caps: { perActionUsd: 250, dailyUsd: 2_500, expiryDays: 14 } },
  haruspex: { label: 'Haruspex', caps: { perActionUsd: 500, dailyUsd: 5_000, expiryDays: 7 } },
  auspex: { label: 'Auspex', caps: { perActionUsd: 1_000, dailyUsd: 5_000, expiryDays: 30 } },
};

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.eth$/, '');
}

export function CopyTradeMandate() {
  const params = useSearchParams();
  const copy = params.get('copy');
  const match = copy ? RECOMMENDED_CAPS[normalize(copy)] : undefined;

  if (!match) {
    return <NewMandateButton />;
  }

  return (
    <NewMandateButton
      prefill={match.caps}
      prefillLabel={`Copying ${match.label} — recommended caps prefilled`}
      autoOpen
    />
  );
}
