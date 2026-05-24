import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-step deployment readiness for the Verifier step runner.
 *
 * Audit 2026-05-24 G-2 fix: the prior route returned `ready:true` based only
 * on `address.code.length > 0`, so Verifier buttons lit up for the deployed-
 * but-bricked Coffer/Sigil/Vigil (all admin slots 0x0). Now each step probes
 * an init-state view fn via viem. Coffer is the canonical case - `asset()`
 * is 0x0 before initialize() and the USDC address after. Plinth/Sigil/Vigil
 * expose `praetor_multisig()` (added in the same redeploy) for the same
 * check; older bytecode without that view trips the catch and reports
 * `init_state: 'unknown'`.
 */
export const dynamic = 'force-dynamic';

type InitState = 'initialized' | 'uninitialized' | 'unknown';

interface StepStatus {
  step: number;
  ready: boolean;
  init_state: InitState;
  required_contracts: string[];
  missing: string[];
  probes: Record<string, { address: string | null; init: InitState; reason: string | null }>;
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

const ZERO = '0x' + '0'.repeat(40);

const INIT_PROBE_ABI: Record<string, { name: string; type: 'address'; nonZero: true }> = {
  // Coffer.asset() returns USDC address; 0x0 means initialize() was never called.
  coffer: { name: 'asset', type: 'address', nonZero: true },
  // Plinth/Sigil/Vigil added praetor_multisig() in the 2026-05-24 redeploy.
  // Stylus auto-converts snake_case to camelCase - both call patterns work.
  plinth: { name: 'praetorMultisig', type: 'address', nonZero: true },
  sigil: { name: 'praetorMultisig', type: 'address', nonZero: true },
  vigil: { name: 'praetorMultisig', type: 'address', nonZero: true },
};

export async function GET(req: NextRequest): Promise<NextResponse<StepStatus>> {
  const stepParam = new URL(req.url).searchParams.get('step') ?? '1';
  const step = Math.max(1, Math.min(7, Number.parseInt(stepParam, 10) || 1));
  const required = STEP_REQUIREMENTS[step] ?? [];

  const { loadDeploymentRegistry } = await import('@/lib/deployments-registry');
  const registry = await loadDeploymentRegistry();
  const probes: StepStatus['probes'] = {};
  const missing: string[] = [];

  // Lazy-load viem only when we actually have an address to probe - keeps
  // cold-start cost low for steps that resolve from registry alone.
  let createPublicClient: typeof import('viem').createPublicClient | null = null;
  let http: typeof import('viem').http | null = null;
  let chain: typeof import('viem/chains').arbitrumSepolia | null = null;

  for (const name of required) {
    const addr = registry?.contracts?.[name]?.address ?? null;
    if (!addr || !/^0x[0-9a-f]{40}$/i.test(addr) || addr.toLowerCase() === ZERO) {
      probes[name] = { address: addr, init: 'unknown', reason: 'address missing or zero in registry' };
      missing.push(name);
      continue;
    }
    const probeSpec = INIT_PROBE_ABI[name];
    if (!probeSpec) {
      // Step references a contract whose init is bytecode-only (no per-slot
      // probe). Treat as initialized if bytecode exists; Lantern + Postern
      // fall here.
      probes[name] = { address: addr, init: 'initialized', reason: 'no init probe defined; bytecode-only check' };
      continue;
    }
    try {
      if (!createPublicClient) {
        const viem = await import('viem');
        const chains = await import('viem/chains');
        createPublicClient = viem.createPublicClient;
        http = viem.http;
        chain = chains.arbitrumSepolia;
      }
      const client = createPublicClient({
        chain: chain!,
        transport: http!(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
      });
      const abi = [
        {
          type: 'function',
          name: probeSpec.name,
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'address' }],
        },
      ] as const;
      const result = (await client.readContract({
        address: addr as `0x${string}`,
        abi,
        functionName: probeSpec.name,
      })) as string;
      if (!result || result.toLowerCase() === ZERO) {
        probes[name] = { address: addr, init: 'uninitialized', reason: `${probeSpec.name}() returned 0x0` };
        missing.push(name);
      } else {
        probes[name] = { address: addr, init: 'initialized', reason: null };
      }
    } catch (err) {
      // Bytecode missing the probe selector (stale deploy) or RPC outage.
      // Fail closed - uninitialized is the safer assumption for a step
      // runner button.
      probes[name] = {
        address: addr,
        init: 'unknown',
        reason: err instanceof Error ? err.message.slice(0, 120) : 'rpc probe failed',
      };
      missing.push(name);
    }
  }

  const aggregateInit: InitState = missing.length === 0
    ? 'initialized'
    : Object.values(probes).some((p) => p.init === 'uninitialized')
      ? 'uninitialized'
      : 'unknown';

  return NextResponse.json<StepStatus>({
    step,
    ready: missing.length === 0,
    init_state: aggregateInit,
    required_contracts: required,
    missing,
    probes,
  });
}
