import { Hono } from 'hono';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { safeErrorDetail } from '../lib/error-safe';

/**
 * Options pricing endpoint, wired to the Stoa Black-Scholes contract.
 *
 * **Status:** the underlying Stoa module is a Phase-2 scaffold per PRD §17 —
 * it returns 0 from price_call/price_put and conservative-upper-bound from
 * margin_for_long_call until the Trailblazer AI grant lands. This endpoint
 * surfaces the scaffold state honestly via the `module_status` field on every
 * response so the verifier UI and any agent caller can detect-and-degrade.
 *
 * Per `.claude/rules/writing.md` honesty pattern: we do NOT publish a fake
 * "0.00 USD" as a live option price. The response always includes
 * `module_status: "phase-2-scaffold"` plus a `live: false` flag until the
 * real BSM math is wired up.
 */
export const optionsRouter = new Hono<{
  Bindings: { ARBITRUM_SEPOLIA_RPC: string; STOA_ADDRESS?: string; ENV?: string };
}>();

const STOA_ABI = [
  {
    type: 'function',
    name: 'price_call',
    stateMutability: 'pure',
    inputs: [
      { name: 'spot_e18', type: 'uint256' },
      { name: 'strike_e18', type: 'uint256' },
      { name: 'vol_e18', type: 'uint256' },
      { name: 'rate_e18', type: 'uint256' },
      { name: 'time_to_expiry_seconds', type: 'uint256' },
    ],
    outputs: [{ name: 'call_price_e18', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'price_put',
    stateMutability: 'pure',
    inputs: [
      { name: 'spot_e18', type: 'uint256' },
      { name: 'strike_e18', type: 'uint256' },
      { name: 'vol_e18', type: 'uint256' },
      { name: 'rate_e18', type: 'uint256' },
      { name: 'time_to_expiry_seconds', type: 'uint256' },
    ],
    outputs: [{ name: 'put_price_e18', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'margin_for_long_call',
    stateMutability: 'pure',
    inputs: [
      { name: 'spot_e18', type: 'uint256' },
      { name: 'strike_e18', type: 'uint256' },
      { name: 'vol_e18', type: 'uint256' },
      { name: 'rate_e18', type: 'uint256' },
      { name: 'time_to_expiry_seconds', type: 'uint256' },
      { name: 'contracts_e18', type: 'uint256' },
    ],
    outputs: [{ name: 'initial_margin_e18', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'module_status',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

// Decimal-integer string (Stoa takes 1e18 fixed-point). Reject scientific notation
// and floats — they would silently coerce in BigInt() and the caller would
// over- or under-pay margin without a clear error.
const FIXED_POINT_REGEX = /^\d{1,40}$/;

function parseFixed(raw: string | undefined, field: string): bigint {
  if (!raw || !FIXED_POINT_REGEX.test(raw)) {
    throw new Error(`invalid_${field}: pass as 1e18 fixed-point decimal integer string (1–40 digits)`);
  }
  return BigInt(raw);
}

optionsRouter.get('/price', async (c) => {
  const stoa = c.env.STOA_ADDRESS;
  if (!stoa || !/^0x[0-9a-fA-F]{40}$/.test(stoa)) {
    return c.json(
      {
        live: false,
        module_status: 'not-deployed',
        detail: 'Stoa contract address not configured for this Codex deployment.',
      },
      503
    );
  }
  const side = c.req.query('side') ?? 'call';
  if (side !== 'call' && side !== 'put') {
    return c.json({ error: 'invalid_side', detail: 'side must be call or put' }, 400);
  }
  let spot: bigint, strike: bigint, vol: bigint, rate: bigint, expiry: bigint;
  try {
    spot = parseFixed(c.req.query('spot_e18'), 'spot_e18');
    strike = parseFixed(c.req.query('strike_e18'), 'strike_e18');
    vol = parseFixed(c.req.query('vol_e18'), 'vol_e18');
    rate = parseFixed(c.req.query('rate_e18'), 'rate_e18');
    expiry = parseFixed(c.req.query('time_to_expiry_seconds'), 'time_to_expiry_seconds');
  } catch (err) {
    return c.json({ error: 'invalid_input', detail: (err as Error).message }, 400);
  }

  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(c.env.ARBITRUM_SEPOLIA_RPC),
  });

  try {
    const [price, status] = await Promise.all([
      // Audit U-31: see options.ts:229 for the `as never` rationale.
      client.readContract({
        address: stoa as `0x${string}`,
        abi: STOA_ABI,
        functionName: side === 'call' ? 'price_call' : 'price_put',
        args: [spot, strike, vol, rate, expiry],
      } as never),
      client.readContract({
        address: stoa as `0x${string}`,
        abi: STOA_ABI,
        functionName: 'module_status',
      } as never),
    ]);
    const isScaffold = status === 'phase-2-scaffold';
    return c.json({
      live: !isScaffold,
      module_status: status,
      side,
      price_e18: price.toString(),
      // Honesty: a 0 price from the scaffold is NOT a real quote. Surface that
      // explicitly so the verifier UI renders a Phase-2 placeholder card
      // rather than misleading "0.00 USD" text.
      note: isScaffold
        ? 'Stoa is a Phase-2 scaffold. Real Black-Scholes math ships when Trailblazer AI grant lands (PRD §17).'
        : undefined,
    });
  } catch (err) {
    return c.json(
      { error: 'rpc_unavailable', detail: safeErrorDetail(err, c.env) },
      503
    );
  }
});

optionsRouter.get('/margin', async (c) => {
  const stoa = c.env.STOA_ADDRESS;
  if (!stoa || !/^0x[0-9a-fA-F]{40}$/.test(stoa)) {
    return c.json(
      {
        live: false,
        module_status: 'not-deployed',
        detail: 'Stoa contract address not configured for this Codex deployment.',
      },
      503
    );
  }
  let spot: bigint, strike: bigint, vol: bigint, rate: bigint, expiry: bigint, contracts: bigint;
  try {
    spot = parseFixed(c.req.query('spot_e18'), 'spot_e18');
    strike = parseFixed(c.req.query('strike_e18'), 'strike_e18');
    vol = parseFixed(c.req.query('vol_e18'), 'vol_e18');
    rate = parseFixed(c.req.query('rate_e18'), 'rate_e18');
    expiry = parseFixed(c.req.query('time_to_expiry_seconds'), 'time_to_expiry_seconds');
    contracts = parseFixed(c.req.query('contracts_e18'), 'contracts_e18');
  } catch (err) {
    return c.json({ error: 'invalid_input', detail: (err as Error).message }, 400);
  }

  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(c.env.ARBITRUM_SEPOLIA_RPC),
  });

  try {
    const [margin, status] = await Promise.all([
      client.readContract({
        address: stoa as `0x${string}`,
        abi: STOA_ABI,
        functionName: 'margin_for_long_call',
        args: [spot, strike, vol, rate, expiry, contracts],
      } as never),
      client.readContract({
        address: stoa as `0x${string}`,
        abi: STOA_ABI,
        functionName: 'module_status',
      } as never),
    ]);
    const isScaffold = status === 'phase-2-scaffold';
    return c.json({
      live: !isScaffold,
      module_status: status,
      margin_e18: margin.toString(),
      // Scaffold returns full underlying notional as conservative upper bound.
      // Plinth treats this as a strict ceiling so a scaffold can't under-margin.
      note: isScaffold
        ? 'Scaffold returns full underlying notional as conservative upper bound. Real SPAN-style BSM margin ships in Phase-2.'
        : undefined,
    });
  } catch (err) {
    return c.json(
      { error: 'rpc_unavailable', detail: safeErrorDetail(err, c.env) },
      503
    );
  }
});

optionsRouter.get('/status', async (c) => {
  const stoa = c.env.STOA_ADDRESS;
  if (!stoa || !/^0x[0-9a-fA-F]{40}$/.test(stoa)) {
    return c.json({
      live: false,
      module_status: 'not-deployed',
      detail: 'Stoa contract address not configured for this Codex deployment.',
    });
  }
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(c.env.ARBITRUM_SEPOLIA_RPC),
  });
  try {
    // Audit U-31: viem 2.48 ReadContractParameters typedef requires
    // `authorizationList` for EIP-7702 compatibility but it's optional at
    // runtime. The `as never` short-circuit silences the strict-mode
    // check without weakening the inferred return type — viem's runtime
    // ignores the missing field. Same shape at every readContract call
    // site in this file.
    const status = await client.readContract({
      address: stoa as `0x${string}`,
      abi: STOA_ABI,
      functionName: 'module_status',
    } as never);
    return c.json({ live: status !== 'phase-2-scaffold', module_status: status, address: stoa });
  } catch (err) {
    return c.json({ error: 'rpc_unavailable', detail: safeErrorDetail(err, c.env) }, 503);
  }
});
