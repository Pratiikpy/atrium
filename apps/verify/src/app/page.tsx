import { LandingHeader } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { ProductSection } from '@/components/landing/product-section';
import { PlinthSection } from '@/components/landing/plinth-section';
import { AqueductSection } from '@/components/landing/aqueduct-section';
import { SigilSection } from '@/components/landing/sigil-section';
import { LanternSection } from '@/components/landing/lantern-section';
import { NumbersSection } from '@/components/landing/numbers-section';
import { SubsystemsSection } from '@/components/landing/subsystems-section';
import { ArchitectureSection } from '@/components/landing/architecture-section';
import { CohortSection } from '@/components/landing/cohort-section';
import { ClosingSection } from '@/components/landing/closing-section';
import { LandingFooter } from '@/components/landing/footer';

export const metadata = {
  title: 'Atrium - unified margin prime brokerage for the EVM',
  description:
    'One wallet. Every venue. One number. Atrium nets your collateral across seven onchain venues under one SPAN-style margin calculation.',
};

/**
 * Audit 2026-05-24 C-3 fix: the prior root `/` was rewritten in
 * `next.config.mjs` to a 1.6 MB static `landing-v2.html` Vite-dev bundle
 * with hardcoded fake numbers (Math.random TVL ticker, eight partner logos
 * with no committed source, $4.20M TVL, 37 agents, 42,392 queries). All of
 * those failed the writing.md sourcing rule. The fix promotes the existing
 * `/legacy` React landing to canonical `/` - same 11-section reproduction
 * of `desing/Atrium.html` but with numbers hydrating from /api routes that
 * read Scribe + RPC and degrade to honest empty/zero on miss.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-parchment">
      <LandingHeader />
      <HeroSection />
      <ProductSection />
      <PlinthSection />
      <AqueductSection />
      <SigilSection />
      <LanternSection />
      <NumbersSection />
      <SubsystemsSection />
      <ArchitectureSection />
      <CohortSection />
      <ClosingSection />
      <LandingFooter />
    </div>
  );
}
