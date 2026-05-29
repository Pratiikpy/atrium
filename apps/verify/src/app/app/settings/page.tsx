import { AppShell } from '@/components/app-shell';
import { SettingsTabs, SettingsTabPanel } from '@/components/settings/subnav';
import { WalletDetailCard } from '@/components/settings/wallet-detail';
import { GasSponsorshipCard } from '@/components/settings/gas-sponsorship';
import { ConnectedSitesCard } from '@/components/settings/connected-sites';
import { SessionKeysView } from '@/components/settings/session-keys-view';
import { SettingsMobile } from '@/components/mobile/panels/settings-mobile';

export const metadata = {
  title: 'Atrium · Settings',
  description: 'Wallet, session keys, recovery, network, notifications, account.',
};

// SessionKeysView uses wagmi useAccount/useWriteContract (cleanExpired write);
// force-dynamic keeps prerender from throwing, matching /app/trade + /app/vault.
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <AppShell
      active="/app/settings"
      breadcrumb={[
        { label: 'Settings' },
        { label: 'Wallet · Postern' },
      ]}
    >
      <SettingsMobile />
      <div className="hidden md:block">
      <header>
        <p className="eyebrow">Settings · Postern</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          Wallet &amp; account
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Postern is the ERC-4337 + EIP-7702 layer that holds your passkey, session keys, and gas sponsorship credit.
        </p>
      </header>

      <section className="mt-8">
        <SettingsTabs>
          <SettingsTabPanel tab="wallet">
            <WalletDetailCard />
            <GasSponsorshipCard />
            <ConnectedSitesCard />
          </SettingsTabPanel>
          <SettingsTabPanel tab="session-keys">
            {/* Session keys are now wired to the deployed PosternKeyRegistry,
                so this tab renders the real list instead of a "coming soon"
                banner (readyMonth dropped in subnav). Same component as the
                deep-link route /app/settings/session-keys. */}
            <SessionKeysView />
          </SettingsTabPanel>
          {/* The other 4 tabs (recovery / network / notifications / account)
              render only the "coming Month X" banner that SettingsTabs
              provides automatically. Real cards land per the roadmap.
              Audit P-6 fix. */}
        </SettingsTabs>
      </section>
      </div>
    </AppShell>
  );
}
