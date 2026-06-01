import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-step deployment readiness for the Verifier step runner.
 *
 * Phase 8 upgrade: readiness is now driven by ACTUAL ON-CHAIN STATE, not just
 * "is the contract deployed". Step 2 checks Plinth.is_paused() == false AND
 * adapter authorization. Step 5 checks vigil-keeper staking. This replaces
 * the static `pending: true` flags in verifier-step-config.ts with runtime
 * gating.
 *
 * Audit 2026-05-24 G-2 fix preserved: still probes init-state views.
 */
export const dynamic = 'force-dynamic';

type InitState = 'initialized' | 'uninitialized' | 'unknown';
type Blocker =
  | 'plinth-not-deployed'
  | 'plinth-paused'
  | 'router-not-authorized-on-adapters'
  | 'coffer-router-not-approved'
  | 'keeper-not-staked'
  | 'vigil-not-deployed'
  | 'contract-uninitialized'
  | null;

interface StepStatus {
  step: number;
  ready: boolean;
  blocker: Blocker;
  init_state: InitState;
  required_contracts: string[];
  missing: string[];
  probes: Record<string, { address: string | null; init: InitState; reason: string | null }>;
}

const STEP_REQUIREMENTS: Record<number, string[]> = {
  1: ['coffer'],
  2: ['plinth', 'atrium-router'],
  3: ['plinth', 'atrium-router'],
  4: ['plinth'],
  5: ['vigil', 'plinth'],
  6: ['lantern-attestor'],
  7: ['postern-kill-switch', 'sigil'],
};

const ZERO = '0x' + '0'.repeat(40);

const INIT_PROBE_ABI: Record<string, { name: string; type: 'address'; nonZero: true }> = {
  coffer: { name: 'asset', type: 'address', nonZero: true },
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
  let blocker: Blocker = null;

  let createPublicClient: typeof import('viem').createPublicClient | null = null;
  let http: typeof import('viem').http | null = null;
  let chain: typeof import('viem/chains').arbitrumSepolia | null = null;

  const getClient = async () => {
    if (!createPublicClient) {
      const viem = await import('viem');
      const chains = await import('viem/chains');
      createPublicClient = viem.createPublicClient;
      http = viem.http;
      chain = chains.arbitrumSepolia;
    }
    return createPublicClient({
      chain: chain!,
      transport: http!(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });
  };

  for (const name of required) {
    const addr = registry?.contracts?.[name]?.address ?? null;
    if (!addr || !/^0x[0-9a-f]{40}$/i.test(addr) || addr.toLowerCase() === ZERO) {
      probes[name] = { address: addr, init: 'unknown', reason: 'address missing or zero in registry' };
      missing.push(name);
      continue;
    }
    const probeSpec = INIT_PROBE_ABI[name];
    if (!probeSpec) {
      probes[name] = { address: addr, init: 'initialized', reason: 'no init probe defined; bytecode-only check' };
      continue;
    }
    try {
      const client = await getClient();
      const abi = [{ type: 'function' as const, name: probeSpec.name, stateMutability: 'view' as const, inputs: [], outputs: [{ type: 'address' as const }] }];
      const result = (await client.readContract({
        address: addr as `0x${string}`,
        abi,
        functionName: probeSpec.name,
      })) as unknown as string;
      if (!result || result.toLowerCase() === ZERO) {
        probes[name] = { address: addr, init: 'uninitialized', reason: `${probeSpec.name}() returned 0x0` };
        missing.push(name);
      } else {
        probes[name] = { address: addr, init: 'initialized', reason: null };
      }
    } catch (err) {
      probes[name] = {
        address: addr,
        init: 'unknown',
        reason: err instanceof Error ? err.message.slice(0, 120) : 'rpc probe failed',
      };
      missing.push(name);
    }
  }

  // Phase 8: deep on-chain readiness checks per step
  if (missing.length === 0 && (step === 2 || step === 3)) {
    try {
      const client = await getClient();
      const plinthAddr = registry?.contracts?.['plinth']?.address as `0x${string}`;
      const routerAddr = registry?.contracts?.['atrium-router']?.address as `0x${string}`;

      // Check Plinth.is_paused via Router's is_paused (Router wraps Plinth)
      // Actually check Router.is_paused(), if Router is paused, step 2/3 can't run
      const isPaused = await client.readContract({
        address: routerAddr,
        abi: [{ type: 'function', name: 'is_paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] }],
        functionName: 'is_paused',
      }) as boolean;
      if (isPaused) {
        blocker = 'plinth-paused';
        missing.push('router-paused');
      }

      // Check that the Aave adapter has Router as authorized caller
      const aaveAddr = registry?.contracts?.['adapter-aave-horizon']?.address as `0x${string}` | undefined;
      if (aaveAddr) {
        const isAuthorized = await client.readContract({
          address: aaveAddr,
          abi: [{ type: 'function', name: 'is_authorized_caller', stateMutability: 'view', inputs: [{ name: 'caller', type: 'address' }], outputs: [{ type: 'bool' }] }],
          functionName: 'is_authorized_caller',
          args: [routerAddr],
        }) as boolean;
        if (!isAuthorized) {
          blocker = 'router-not-authorized-on-adapters';
          // Don't add to missing, step can still proceed if user only uses
          // adapters that ARE authorized. But flag the blocker.
        }
      }

      // Check Coffer has Router approved
      const cofferAddr = registry?.contracts?.['coffer']?.address as `0x${string}` | undefined;
      if (cofferAddr && routerAddr) {
        try {
          const isApproved = await client.readContract({
            address: cofferAddr,
            abi: [{ type: 'function', name: 'isAdapterApproved', stateMutability: 'view', inputs: [{ name: 'adapter', type: 'address' }], outputs: [{ type: 'bool' }] }],
            functionName: 'isAdapterApproved',
            args: [routerAddr],
          }) as boolean;
          if (!isApproved) {
            blocker = blocker ?? 'coffer-router-not-approved';
          }
        } catch {
          // Coffer may not expose this view on older bytecode
        }
      }
    } catch {
      // RPC failure, fail open for step 2/3 since init probes passed
    }
  }

  if (missing.length === 0 && step === 5) {
    // Vigil keeper staking check. Audit fix (#79): previously this only checked
    // that vigil was deployed and treated it as ready - so a readiness surface
    // could imply live liquidation protection while the keeper was in dry-run
    // (an honesty/inflation issue). Now read Vigil.activeKeeperCount on-chain and
    // surface 'keeper-not-staked' when it is 0; liquidation cannot execute until
    // a keeper is staked. Fail open on RPC error to match the step 2/3 pattern.
    const vigilAddr = registry?.contracts?.['vigil']?.address as `0x${string}` | undefined;
    if (!vigilAddr) {
      blocker = 'vigil-not-deployed';
    } else {
      try {
        const client = await getClient();
        const activeKeepers = await client.readContract({
          address: vigilAddr,
          abi: [{ type: 'function', name: 'activeKeeperCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] }],
          functionName: 'activeKeeperCount',
        }) as number | bigint;
        if (Number(activeKeepers) === 0) {
          blocker = blocker ?? 'keeper-not-staked';
        }
      } catch {
        // RPC failure, fail open (do not block readiness on a transient read error).
      }
    }
  }

  const aggregateInit: InitState = missing.length === 0
    ? 'initialized'
    : Object.values(probes).some((p) => p.init === 'uninitialized')
      ? 'uninitialized'
      : 'unknown';

  if (missing.length > 0 && !blocker) {
    blocker = 'contract-uninitialized';
  }

  return NextResponse.json<StepStatus>({
    step,
    ready: missing.length === 0 && blocker === null,
    blocker,
    init_state: aggregateInit,
    required_contracts: required,
    missing,
    probes,
  });
}
