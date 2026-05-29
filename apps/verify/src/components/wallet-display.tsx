'use client';

import { useEnsName } from 'wagmi';
import { getAddress } from 'viem';

/**
 * Renders an address with ENS resolution and EIP-55 checksumming.
 * Shows ENS name if available, else checksummed 0x1234…5678.
 */
export function WalletDisplay({
  address,
  className,
}: {
  address: `0x${string}`;
  className?: string;
}) {
  const { data: ensName } = useEnsName({ address });
  const checksummed = getAddress(address);
  const display = ensName ?? `${checksummed.slice(0, 6)}…${checksummed.slice(-4)}`;

  return (
    <span className={className ?? 'font-mono text-xs'} title={checksummed}>
      {display}
    </span>
  );
}
