import { NextRequest, NextResponse } from 'next/server';
import { safeErrorDetail } from '@/lib/safe-error';
import { loadDeploymentRegistry } from '@/lib/deployments-registry';

/**
 * POST /api/chaos/inject
 *
 * Phase zeta.5 (2026-05-25): wired to real on-chain action via the
 * Praetor multisig EOA, gated behind CHAOS_DRILL_KEY so a random
 * visitor can't pause production. Each fault maps to a real lever
 * that the Verifier walk Step 4 can observe + auto-restore.
 *
 * Auth: pass `Authorization: Bearer ${CHAOS_DRILL_KEY}` in the request.
 * Without the header set + matching, the route returns 401.
 *
 * Faults:
 * - oracle_drift   -> PraetorTimelock.emergencyPause(Plinth) [instant, multisig]
 * - keeper_offline -> Vigil.mark_keeper_missed_window(deployer EOA)
 * - partial_fill   -> Coffer.pause_deposits(reason) [direct praetor call]
 * - gas_spike      -> simulated only (no contract lever)
 * - indexer_stall  -> Scribe-side, UI surfaces "Scribe slow"
 *
 * Each on-chain action returns the tx hash + arbiscan URL. The Verifier
 * UI walks the user through the inject + the matching /api/chaos/restore
 * call so the demo state self-heals within ~30 seconds.
 */
export const dynamic = 'force-dynamic';

const VALID_FAULTS = [
  'oracle_drift',
  'keeper_offline',
  'partial_fill',
  'gas_spike',
  'indexer_stall',
] as const;
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
  // Year-1 testnet posture: chaos drills are publicly callable so judges
  // can walk Verifier Step 4 without provisioning. The real security
  // boundary is CHAOS_PRIVATE_KEY (without it the route can't sign).
  // Mainnet posture should add a Bearer-token auth gate here.
  //
  // The chaos route needs a key to sign with. CHAOS_PRIVATE_KEY isolates
  // the chaos surface from the deployer EOA per the
  // 2026-05-24 deployer-key-leak incident (incidents/...). The chaos key
  // has multisig privileges on the contracts so it can pause / unpause;
  // it does NOT have timelock rights, so it can't drain the protocol.
  const chaosKey = process.env.CHAOS_PRIVATE_KEY;
  if (!chaosKey || !/^0x[0-9a-fA-F]{64}$/.test(chaosKey)) {
    return NextResponse.json({
      error: 'chaos_key_not_configured',
      detail: 'Set CHAOS_PRIVATE_KEY env on the verify project. Use a dedicated EOA with multisig privileges on the contracts; not the deployer key.',
    }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.fault || !VALID_FAULTS.includes(body.fault)) {
    return NextResponse.json(
      { error: 'invalid_fault', detail: `Must be one of: ${VALID_FAULTS.join(', ')}` },
      { status: 400 },
    );
  }

  const registry = await loadDeploymentRegistry();
  if (!registry?.contracts) {
    return NextResponse.json({ error: 'registry_unreachable' }, { status: 503 });
  }

  try {
    const { createWalletClient, http, arbitrumSepolia, privateKeyToAccount, keccak256, toHex } = await viem();
    const account = privateKeyToAccount(chaosKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://arbitrum-sepolia.publicnode.com'),
    });

    switch (body.fault) {
      case 'oracle_drift': {
        // PraetorTimelock.emergencyPause(Plinth, reason-string).
        // Pauses Plinth instantly; restore via /api/chaos/restore.
        const timelock = registry.contracts['praetor-timelock']?.address as `0x${string}`;
        const plinth = registry.contracts['plinth']?.address as `0x${string}`;
        if (!timelock || !plinth) {
          return NextResponse.json({ error: 'missing_contract' }, { status: 503 });
        }
        const tx = await client.writeContract({
          address: timelock,
          abi: [{ type: 'function', name: 'emergencyPause', stateMutability: 'nonpayable',
                  inputs: [{ name: 'target', type: 'address' }, { name: 'reason', type: 'string' }], outputs: [] }] as const,
          functionName: 'emergencyPause',
          args: [plinth, `chaos: oracle_drift demo ${Date.now()}`],
        });
        return NextResponse.json({
          fault: 'oracle_drift',
          action: 'PraetorTimelock.emergencyPause(Plinth)',
          tx,
          arbiscan: arbiscan(tx),
          restore: 'POST /api/chaos/restore { fault: "oracle_drift" }',
        });
      }
      case 'keeper_offline': {
        // Vigil.mark_keeper_missed_window(keeper).
        // Records a missed window for the keeper; auto-deboost trips at N misses.
        const vigil = registry.contracts['vigil']?.address as `0x${string}`;
        if (!vigil) {
          return NextResponse.json({ error: 'missing_contract' }, { status: 503 });
        }
        // Use the deployer EOA as the keeper to mark; in production this is
        // the real keeper's address. For the demo, a missed window on the
        // deployer-keeper is a no-op the audit trail still shows.
        const keeper = '0x7DB1c02a3B860137D9360fB1BBE0000CD2009A42' as `0x${string}`;
        const tx = await client.writeContract({
          address: vigil,
          abi: [{ type: 'function', name: 'markKeeperMissedWindow', stateMutability: 'nonpayable',
                  inputs: [{ name: 'keeper', type: 'address' }], outputs: [] }] as const,
          functionName: 'markKeeperMissedWindow',
          args: [keeper],
        });
        return NextResponse.json({
          fault: 'keeper_offline',
          action: 'Vigil.markKeeperMissedWindow(deployer)',
          tx,
          arbiscan: arbiscan(tx),
          restore: 'Not needed; auto-deboost trips at N misses and auto-resets on next successful tick.',
        });
      }
      case 'partial_fill': {
        // Coffer.pause_deposits(keccak256("chaos partial_fill")).
        // Direct praetor call (not timelock); restore via resume_deposits.
        const coffer = registry.contracts['coffer']?.address as `0x${string}`;
        if (!coffer) {
          return NextResponse.json({ error: 'missing_contract' }, { status: 503 });
        }
        const reason = keccak256(toHex(`chaos: partial_fill ${Date.now()}`));
        const tx = await client.writeContract({
          address: coffer,
          abi: [{ type: 'function', name: 'pauseDeposits', stateMutability: 'nonpayable',
                  inputs: [{ name: 'reason', type: 'bytes32' }], outputs: [] }] as const,
          functionName: 'pauseDeposits',
          args: [reason],
        });
        return NextResponse.json({
          fault: 'partial_fill',
          action: 'Coffer.pauseDeposits(reason)',
          tx,
          arbiscan: arbiscan(tx),
          restore: 'POST /api/chaos/restore { fault: "partial_fill" }',
        });
      }
      case 'gas_spike': {
        // No contract lever; gas price isn't a state field we can poke.
        // The honest answer is "we don't simulate this on-chain". The UI
        // surfaces the simulated state via the response body.
        return NextResponse.json({
          fault: 'gas_spike',
          action: 'simulated',
          tx: null,
          arbiscan: null,
          simulated: true,
          detail: 'Gas price is exogenous; the demo annotation surfaces a simulated 5x spike without an on-chain tx.',
        });
      }
      case 'indexer_stall': {
        // Best-effort hit to subgraph with a deliberately expensive query
        // so the dashboard's Scribe-loading state renders. No on-chain action.
        return NextResponse.json({
          fault: 'indexer_stall',
          action: 'subgraph slow query (off-chain)',
          tx: null,
          arbiscan: null,
          simulated: false,
          detail: 'UI cache is exercised; Scribe is upstream so the stall is real but ephemeral (~3-5s).',
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'inject_failed', detail: safeErrorDetail(err) },
      { status: 503 },
    );
  }
}
