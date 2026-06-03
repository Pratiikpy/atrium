import { AppShell } from '@/components/app-shell';
import { NotificationsList } from '@/components/notifications/list';
import { NotificationsMobile } from '@/components/mobile/panels/notifications-mobile';

export const metadata = {
  title: 'Notifications',
  description: 'Mandate revocations, liquidation triggers, attestation publications.',
};

/**
 * Notifications inbox. Wave-R: the topbar Bell icon now lands here.
 * Reads from `/api/notifications` which aggregates Scribe events the user
 * should care about (liquidations on their account, mandate revocations,
 * Lantern attestations affecting their balance, withdrawal SLA hits).
 */
export default function NotificationsPage() {
  return (
    <AppShell
      active="/app/notifications"
      breadcrumb={[
        { label: 'Notifications' },
      ]}
      // Viewport slots: only the active layout mounts, so the inbox query
      // fires once instead of on both the mobile panel and desktop list.
      mobile={<div className="md:hidden"><NotificationsMobile /></div>}
      desktop={
      <div className="hidden md:block">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
            Inbox
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Account-level events from Scribe. Mandate validations and revocations,
            liquidation triggers, attestation publications, withdrawal SLA hits.
          </p>
        </div>
      </header>

      <section className="mt-8">
        <NotificationsList />
      </section>
      </div>
      }
    />
  );
}
