import { AppShell } from '@/components/app-shell';
import { SessionKeysView } from '@/components/settings/session-keys-view';

export const metadata = {
  title: 'Session keys',
  description: 'List, prune, and revoke the ERC-7715 session keys issued by your Postern wallet.',
};

// wagmi hooks (useAccount/useWriteContract) in SessionKeysView need the
// WagmiProvider in context; force-dynamic keeps prerender from throwing.
// Matches /app/trade and /app/vault.
export const dynamic = 'force-dynamic';

export default function SessionKeysPage() {
  const content = (
    <>
      <header>
        <p className="eyebrow">Session keys · Postern</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          Keys your agents trade with
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every time you delegate to an agent, Postern issues a session key scoped to that mandate.
          They are recorded on-chain so you can see exactly what can act on your behalf, and revoke
          it. Your master passkey never moves.
        </p>
      </header>

      <SessionKeysView />
    </>
  );
  return (
    <AppShell
      active="/app/settings"
      breadcrumb={[
        { label: 'Settings' },
        { label: 'Session keys · Postern' },
      ]}
      desktop={content}
      // Theme-bleed fix (use-everything sweep 2026-06-03): no dedicated dark
      // mobile panel exists for this Postern surface, so on mobile it fell back
      // to `children` and rendered light cards on the dark OLED shell. Render the
      // same content on a light parchment sheet so it reads correctly.
      mobile={<div className="rounded-2xl bg-parchment p-4 text-ink">{content}</div>}
    />
  );
}
