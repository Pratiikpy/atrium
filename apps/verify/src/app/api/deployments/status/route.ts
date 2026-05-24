import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-step deployment readiness — read by the Verifier step runner so the
 * "Run step N" button is only enabled when the on-chain wiring is in
 * `deployments/{network}.json`. Audit J-C2 fix: replaces the prior
 * always-throw behaviour with a real status surface.
 *
 * For Year-1 testnet, "ready" means the contract address exists in the
 * deployments registry on the build server. Each step maps to one or more
 * contracts:
 *   1 → coffer
 *   2 → plinth
 *   3 → plinth (update_margin path)
 *   4 → chaos-agent / oracle drift scenario
 *   5 → vigil
 *   6 → lantern-attestor
 *   7 → postern-kill-switch
 */
export const dynamic = 'force-dynamic';

interface StepStatus {
  step: number;
  ready: boolean;
  required_contracts: string[];
  missing: string[];
}

const STEP_REQUIREMENTS: Record<number, string[]> = {
  1: ['coffer'],
  2: ['plinth'],
  3: ['plinth'],
  4: ['plinth'],
  5: ['vigil', 'plinth'],
  6: ['lantern-attestor'],
  7: ['postern-kill-switch', 'sigil'],
};

export async function GET(req: NextRequest): Promise<NextResponse<StepStatus>> {
  // Audit U-9 fix: use the standards-compliant URL constructor instead of
  // NextRequest's `nextUrl` so the route is testable with a plain Request.
  const stepParam = new URL(req.url).searchParams.get('step') ?? '1';
  const step = Math.max(1, Math.min(7, Number.parseInt(stepParam, 10) || 1));
  const required = STEP_REQUIREMENTS[step] ?? [];

  // Wave-II refactor: shared registry helper. Audit HH-2 + the zero-address
  // sentinel rejection now apply uniformly — placeholder records no longer
  // light up step buttons as "ready".
  const { loadDeploymentRegistry } = await import('@/lib/deployments-registry');
  const registry = await loadDeploymentRegistry();
  const ZERO = '0x' + '0'.repeat(40);
  const missing = required.filter((name) => {
    const addr = registry?.contracts?.[name]?.address;
    if (!addr) return true;
    if (!/^0x[0-9a-f]{40}$/i.test(addr)) return true;
    if (addr.toLowerCase() === ZERO) return true;
    return false;
  });
  return NextResponse.json<StepStatus>({
    step,
    ready: missing.length === 0,
    required_contracts: required,
    missing,
  });
}
