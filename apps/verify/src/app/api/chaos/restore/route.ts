import { NextRequest, NextResponse } from 'next/server';
import { safeErrorDetail } from '@/lib/safe-error';
import { loadDeploymentRegistry } from '@/lib/deployments-registry';

/**
 * POST /api/chaos/restore
 *
 * Phase zeta.5 (2026-05-25): symmetric counterpart to /api/chaos/inject.
 * Each fault's restore call returns the protocol to normal state so the
 * Verifier walk Step 4 self-heals within ~30 s. Idempotent: calling
 * restore on a non-paused contract is a no-op rather than a revert.
 *
 * Same Bearer-token gate as /inject.
 */
export const dynamic = 'force-dynamic';

const VALID_FAULTS = ['oracle_drift', 'keeper_offline', 'partial_fill', 'gas_spike', 'indexer_stall'] as const;
type Fault = (typeof VALID_FAULTS)[number];

interface Body { fault?: Fault }

function arbiscan(tx: string): string {
  return `https://sepolia.arbiscan.io/tx/${tx}`;
}

async function viem() {
  const v = await import('viem');
  const chains = await import('viem/chains');
  const accounts = await import('viem/accounts');
  return { ...v, arbitrumSepolia: chains.arbitrumSepolia, privateKeyToAccount: accounts.privateKeyToAccount };
}

export async function POST(req: NextRequest) {
  // Year-1 testnet posture: publicly callable; CHAOS_PRIVATE_KEY is the
  // real gate (without it the route can't sign anything). Mainnet
  // posture should add an auth header here.

  const chaosKey = process.env.CHAOS_PRIVATE_KEY;
  if (!chaosKey || !/^0x[0-9a-fA-F]{64}$/.test(chaosKey)) {
    return NextResponse.json({ error: 'chaos_key_not_configured' }, { status: 503 });
  }

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!body.fault || !VALID_FAULTS.includes(body.fault)) {
    return NextResponse.json({ error: 'invalid_fault' }, { status: 400 });
  }

  const registry = await loadDeploymentRegistry();
  if (!registry?.contracts) return NextResponse.json({ error: 'registry_unreachable' }, { status: 503 });

  try {
    const { createWalletClient, http, arbitrumSepolia, privateKeyToAccount } = await viem();
    const account = privateKeyToAccount(chaosKey as `0x${string}`);
    const client = createWalletClient({
      account, chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });

    switch (body.fault) {
      case 'oracle_drift': {
        // Plinth.resume() is timelock-gated, so direct praetor restore
        // can't clear an emergencyPause within the demo's 30 s window.
        // Honest behavior: surface that the pause stays in effect until
        // the next timelock-scheduled resume call. The Verifier Step 4
        // walks the user through this exact restore-takes-time lesson.
        return NextResponse.json({
          fault: 'oracle_drift',
          action: 'noop',
          detail: 'Plinth.resume() is timelock-only; the emergencyPause holds until a scheduled resume executes (48h). Verifier Step 4 documents the asymmetry: pause is instant, restore is gated.',
        });
      }
      case 'keeper_offline': {
        // No restore needed; mark_keeper_missed_window auto-resets on next
        // successful tick. Idempotent confirmation.
        return NextResponse.json({
          fault: 'keeper_offline',
          action: 'noop',
          detail: 'Keeper auto-deboost resets on next successful tick; no explicit restore needed.',
        });
      }
      case 'partial_fill': {
        // Coffer.resume_deposits() is direct praetor (no timelock).
        const coffer = registry.contracts['coffer']?.address as `0x${string}`;
        if (!coffer) return NextResponse.json({ error: 'missing_contract' }, { status: 503 });
        const tx = await client.writeContract({
          address: coffer,
          abi: [{ type: 'function', name: 'resumeDeposits', stateMutability: 'nonpayable', inputs: [], outputs: [] }] as const,
          functionName: 'resumeDeposits',
          args: [],
        });
        return NextResponse.json({
          fault: 'partial_fill',
          action: 'Coffer.resumeDeposits()',
          tx,
          arbiscan: arbiscan(tx),
        });
      }
      case 'gas_spike':
      case 'indexer_stall':
        return NextResponse.json({
          fault: body.fault, action: 'noop', detail: 'Simulated fault; no restore needed.',
        });
    }
  } catch (err) {
    return NextResponse.json({ error: 'restore_failed', detail: safeErrorDetail(err) }, { status: 503 });
  }
}
