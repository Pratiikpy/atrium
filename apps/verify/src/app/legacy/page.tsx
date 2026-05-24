import Link from 'next/link';
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
  title: 'Atrium — unified margin prime brokerage for the EVM',
  description:
    'One wallet. Every venue. One number. Atrium nets your collateral across seven onchain venues under one SPAN-style margin calculation.',
};

/**
 * The Atrium marketing landing page.
 *
 * Section-for-section reproduction of `desing/Atrium.html` per the
 * playwright extraction. The 11 sections appear in the same order with the
 * same eyebrow / headline / sub copy. Numbers shown render LIVE from
 * Scribe/Plinth; honest empty/zero state until contracts deploy.
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
