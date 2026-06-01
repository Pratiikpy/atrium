import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/* PERF-04: OnboardingFlow is only needed on this route, dynamic import */
const OnboardingFlow = dynamic(
  () => import('@/components/onboarding/onboarding-flow').then((m) => m.OnboardingFlow),
  { loading: () => <Skeleton className="h-96 w-full" /> },
);

export const metadata = {
  title: 'Onboarding',
  description:
    'Passkey, faucet, first cross-margin position. Ninety-second onboarding to the open testnet.',
};

/**
 * /app/onboarding, first-visit flow.
 *
 * Surface matches `design/Atrium App.standalone.html` (file5.js Onboarding):
 * Welcome → Authenticator → Faucet → Margin posted → Done.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
