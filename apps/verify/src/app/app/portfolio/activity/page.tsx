import { AppShell } from '@/components/app-shell';
import { ActivityFeedFull } from '@/components/portfolio/activity-feed-full';
import { ActivityMobile } from '@/components/mobile/panels/activity-mobile';

export const metadata = {
  title: 'Portfolio activity',
  description: 'Full activity history: margin updates, position events, mandate validations.',
};

/**
 * Full-page activity feed (the "View all" link from the Portfolio sidebar
 * lands here). Same data shape as the sidebar `ActivityFeed`, but unbounded
 * and groupable. Audit R (this fire): wires the previously dead "View all"
 * link to a real route.
 */
export default function ActivityPage() {
  return (
    <AppShell
      active="/app/portfolio"
      breadcrumb={[
        { label: 'Portfolio', href: '/app/portfolio' },
        { label: 'Activity' },
      ]}
      // Viewport slots: only the active layout mounts, so the activity feed
      // query fires once instead of on both panel + desktop timeline.
      mobile={<div className="md:hidden"><ActivityMobile /></div>}
      desktop={
      <div className="hidden md:block">
      <header>
        <p className="eyebrow">Activity</p>
        <h1 className="mt-1 font-display text-4xl italic tracking-tight text-ink">
          Full timeline
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every margin update, position event, and Sigil mandate validation indexed by Scribe.
        </p>
      </header>

      <section className="mt-8">
        <ActivityFeedFull />
      </section>
      </div>
      }
    />
  );
}
