import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Single source of truth for reading the deployments registry.
 *
 * Before Wave-HH, 5+ routes each had their own copy of the path-walk
 * pattern (vault/stats, protocol/subsystems, protocol/metrics,
 * portfolio-source, deployments/status). Each copy had subtle drift -
 * different fallback paths, different error swallowing, different
 * "contracts" vs "addresses" key handling.
 *
 * This module centralizes:
 *   - The candidate paths searched (env override → ../../deployments → ../deployments → ./deployments)
 *   - The "what counts as a real address" check (audit GG-2 follow-up:
 *     a 0x000…0 sentinel address is NOT live)
 *   - The single try/catch that returns null on every error
 *
 * Audit P-1 invariant: registry lives at the repo root; the verify app
 * runs from `apps/verify/` so cwd is two levels deep. The path candidates
 * walk up from cwd.
 *
 * Audit U-40 (KNOWN DRIFT): this module reads from
 * `deployments/arbitrum_sepolia.json` (underscore), but
 * `scripts/subgraph-deploy.sh` reads from `deploy/arbitrum-sepolia.json`
 * (dash + singular). When the actual deploy lands, the operator must
 * write addresses to BOTH paths OR unify them. The verify-app's
 * convention is the older one; the script's is the newer Solidity-style
 * one. Unification is out of scope for the verify-app to decide unilaterally
 *, the operator chooses which side wins at deploy time.
 */

export interface DeploymentRecord {
  address?: string;
  block?: number;
  tx?: string;
}

export interface DeploymentsRegistry {
  contracts?: Record<string, DeploymentRecord>;
  network?: string;
  chainId?: number;
}

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

/** Read + parse the deployments registry. Returns null on any error. */
export async function loadDeploymentRegistry(): Promise<DeploymentsRegistry | null> {
  const candidatePaths = [
    process.env.ATRIUM_DEPLOYMENTS_PATH,
    // When deployed (Vercel), Next.js bundles public/ into the serverless
    // function. Looking up via cwd/public works for both dev and prod.
    path.resolve(process.cwd(), 'public/deployments/arbitrum_sepolia.json'),
    path.resolve(process.cwd(), 'apps/verify/public/deployments/arbitrum_sepolia.json'),
    // Repo-root fallbacks for local dev when run from apps/verify/ or root.
    path.resolve(process.cwd(), '../../deployments/arbitrum_sepolia.json'),
    path.resolve(process.cwd(), '../deployments/arbitrum_sepolia.json'),
    path.resolve(process.cwd(), 'deployments/arbitrum_sepolia.json'),
  ].filter((p): p is string => Boolean(p));

  for (const p of candidatePaths) {
    try {
      const text = await readFile(p, 'utf8');
      return JSON.parse(text) as DeploymentsRegistry;
    } catch {
      // keep walking
    }
  }
  return null;
}

/**
 * Resolve a single contract's deployed address. Returns null if:
 *   - registry file is unreadable
 *   - slug is missing from contracts{}
 *   - address is missing, malformed, or the zero-address sentinel
 *
 * The zero-address sentinel handling matters: deployment scripts may
 * write a placeholder record before the actual deploy lands. Treating
 * 0x000…0 as "not live" keeps the landing-page green dots honest.
 */
export async function loadContractAddress(slug: string): Promise<string | null> {
  const reg = await loadDeploymentRegistry();
  if (!reg?.contracts) return null;
  const addr = reg.contracts[slug]?.address;
  if (!addr) return null;
  if (!/^0x[0-9a-f]{40}$/i.test(addr)) return null;
  if (addr.toLowerCase() === ZERO_ADDRESS) return null;
  return addr;
}

/**
 * List slug → address pairs for every contract whose address is a real
 * non-zero hex. Used by `protocol/subsystems` and `protocol/metrics` to
 * count "live" contracts for the landing-page dots.
 */
export async function listLiveContracts(): Promise<Array<{ slug: string; address: string }>> {
  const reg = await loadDeploymentRegistry();
  if (!reg?.contracts) return [];
  const live: Array<{ slug: string; address: string }> = [];
  for (const [slug, record] of Object.entries(reg.contracts)) {
    const addr = record?.address;
    if (!addr) continue;
    if (!/^0x[0-9a-f]{40}$/i.test(addr)) continue;
    if (addr.toLowerCase() === ZERO_ADDRESS) continue;
    // Skip slugs that carry a real address but are NOT live production
    // subsystems: superseded versions, on-chain mocks, placeholder records,
    // and verification-source duplicates. The registry has no status field,
    // so the status lives in the slug. Without this the landing "live" dots
    // and the /venues Try-it mirror counted deprecated + mock + placeholder
    // contracts (e.g. faucet-deprecated-v1, mock-aave-pool) as live.
    if (/deprecated|placeholder|pre-event-extension|current-source|^mock-/.test(slug)) continue;
    live.push({ slug, address: addr });
  }
  return live;
}
