import type { Metadata } from 'next';
import { PitchDeck } from './pitch-deck';

export const metadata: Metadata = {
  title: 'Atrium · Investor Brief',
  description:
    'Cross-venue portfolio margin for the EVM. Deployed and verified on Arbitrum Sepolia + Robinhood Chain testnet. A ten-slide investor brief with real, verifiable on-chain proof.',
  alternates: { canonical: '/pitch' },
};

export default function PitchPage() {
  return <PitchDeck />;
}
