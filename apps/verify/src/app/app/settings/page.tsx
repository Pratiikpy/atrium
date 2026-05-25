import { AppShell } from '@/components/app-shell';
import { SettingsTabs, SettingsTabPanel } from '@/components/settings/subnav';
import { WalletDetailCard } from '@/components/settings/wallet-detail';
import { GasSponsorshipCard } from '@/components/settings/gas-sponsorship';
import { ConnectedSitesCard } from '@/components/settings/connected-sites';
import { SettingsMobile } from '@/components/mobile/panels/settings-mobile';

export const metadata = {
  title: 'Atrium · Settings',
  description: 'Wallet, session keys, recovery, network, notifications, account.',
};

export default function SettingsPage() {
  return (
    <AppShell
      active="/app/settings"
      breadcrumb={[
        { label: 'Settings' },
        { label: 'Postern · wallet' },
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
          {/* The other 5 tabs (session-keys / recovery / network / notifications
              / account) render only the "coming Month X" banner that
              SettingsTabs provides automatically. Real cards land per the
              roadmap. Audit P-6 fix. */}
        </SettingsTabs>
      </section>
      </div>
    </AppShell>
  );
}
