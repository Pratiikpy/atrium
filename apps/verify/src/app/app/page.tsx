import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Atrium · App',
};

/**
 * /app entry redirects to /app/portfolio (the canonical authenticated
 * landing surface). The /app/portfolio route uses real wagmi/viem +
 * Scribe data with honest "Scribe pending" / "Plinth pending" empty
 * states. The Lovable-port DesktopApp + MobileApp components stay
 * available as visual references in apps/verify/src/components/atrium/
 * but they're not rendered anywhere customer-visible — they were
 * designer mocks with Lovable's APP_VENUES / APP_POSITIONS hardcoded
 * data, which would violate the no-fake-data rule on a production
 * surface.
 *
 * Once the underlying DesktopApp panels accept real data via props
 * (Phase 5g), /app can become an aggregated dashboard rendering
 * across all the /app/* sub-routes.
 */
export default function AppPage() {
  redirect('/app/portfolio');
}
