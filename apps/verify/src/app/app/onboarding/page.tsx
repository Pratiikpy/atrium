import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata = {
  title: 'Atrium · onboarding',
  description:
    'Passkey, faucet, first cross-margin position. Ninety-second onboarding to the open testnet.',
};

/**
 * /app/onboarding — first-visit flow.
 *
 * Surface matches `design/Atrium App.standalone.html` (file5.js Onboarding):
 * Welcome → Authenticator → Faucet → Margin posted → Done.
 *
 * The stepper carries local state, so the entire flow lives in a single
 * client component. This page is the server wrapper that sets metadata
 * and renders the flow without the standard sidebar chrome — the prototype
 * intentionally drops the sidebar during onboarding so the user focuses
 * on the linear flow.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
