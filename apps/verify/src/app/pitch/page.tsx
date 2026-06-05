import type { Metadata } from 'next';
import { PitchDeck } from './pitch-deck';

const PITCH_DESC =
  'Cross-venue portfolio margin for the EVM. Deployed and verified on Arbitrum Sepolia + Robinhood Chain testnet. A ten-slide investor brief with real, verifiable on-chain proof.';

export const metadata: Metadata = {
  title: 'Investor Brief',
  description: PITCH_DESC,
  alternates: { canonical: '/pitch' },
  openGraph: {
    title: 'Atrium · Investor Brief',
    description: PITCH_DESC,
    images: ['/opengraph-image'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atrium · Investor Brief',
    description: PITCH_DESC,
    images: ['/opengraph-image'],
  },
};

export default function PitchPage() {
  return <PitchDeck />;
}
