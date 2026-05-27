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
    'One wallet. Every venue. One buying-power number. Atrium nets your collateral across seven onchain venues under one SPAN-style margin calculation.',
};

/**
 * Landing page — port of design/Atriumnew.html. Each section owns its
 * own background; the dark hero + dark agents + dark closing form the
 * page's chrome anchors, with cream sections between.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'oklch(0.984 0.004 85)' }}>
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
