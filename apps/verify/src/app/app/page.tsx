import { redirect } from 'next/navigation';

export const metadata = {
  title: 'App',
};

/**
 * /app entry redirects to /app/portfolio (the canonical authenticated
 * landing surface). The /app/portfolio route uses real wagmi/viem +
 * Scribe data with honest "Scribe pending" / "Plinth pending" empty
 * states. The Lovable-port fake-data components (DesktopApp, MobileApp,
 * Numbers, Features) were deleted in Phase 1 of docs/MASTER_PLAN.md.
 */
export default function AppPage() {
  redirect('/app/portfolio');
}
