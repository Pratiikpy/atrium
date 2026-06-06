'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Shared client-side hook: is a Verifier step / app action ready to fire?
 *
 * Reads `/api/deployments/status?step=<N>` which itself reads
 * `deployments/arbitrum_sepolia.json`. Audit P-3 fix: every disabled-button
 * surface (Trade · Open position, Transfer · Transfer, Vault · Deposit,
 * Agents · Sign mandate, Reserves · Verify my balance) uses this hook to
 * decide whether the button is genuinely disabled and what helper copy to
 * render below it.
 *
 * step 1 → coffer (deposit / vault)
 * step 2 → plinth (open_position / trade)
 * step 3 → plinth (margin recompute, same as step 2)
 * step 4 → chaos agent (off-chain)
 * step 5 → vigil (liquidator)
 * step 6 → lantern attestor (proof of reserves)
 * step 7 → postern kill switch (revoke mandates)
 */
export interface DeploymentStatus {
  step: number;
  ready: boolean;
  required_contracts: string[];
  missing: string[];
}

async function fetchStatus(step: number): Promise<DeploymentStatus> {
  const r = await fetch(`/api/deployments/status?step=${step}`);
  if (!r.ok) throw new Error(`deployment_status_${r.status}`);
  return r.json();
}

export function useDeploymentStatus(step: number) {
  return useQuery({
    queryKey: ['deployment-status', step],
    queryFn: () => fetchStatus(step),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Helper copy for a disabled action button. Returns null if everything is
 * deployed (button should be enabled), or while the query is still
 * loading, so the UI doesn't flash three states (loading → not-ready →
 * ready) per page mount. Audit R-9 fix.
 */
export function readinessMessage(status: DeploymentStatus | undefined, action: string): string | null {
  if (!status) return null; // loading → render nothing under the disabled button
  if (status.ready) return null;
  if (status.missing.length === 0) return `${action} is wired but the deployment registry is empty. F1 deploys Month 1 W2.`;
  return `${action} waits on ${status.missing.join(', ')} to deploy. See the launch roadmap (Phase 2).`;
}
