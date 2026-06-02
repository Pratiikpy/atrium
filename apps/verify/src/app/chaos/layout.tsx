import { buildMetadata } from '@/lib/build-metadata';

export const metadata = buildMetadata({
  title: 'Chaos Mode',
  description: 'Inject faults into the testnet stack and observe recovery. Oracle drift, keeper offline, partial fills, gas spikes, indexer stalls.',
  canonical: '/chaos',
  noindex: true,
});

export default function ChaosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
