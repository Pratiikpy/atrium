import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

/**
 * /docs/api  Codex x402 API reference. Phase eta.8 (2026-05-25).
 *
 * Codex is the x402-payable read API gateway for Atrium. Eight
 * endpoints expose margin, positions, risk, venues, agents,
 * backtests, attestations, options. Every response is HMAC-signed
 * (`X-Codex-Key-Id` header). Rate limits per-IP + per-wallet +
 * per-agent.
 */

export const metadata = {
  title: 'Atrium . Codex API',
  description: 'x402-payable HTTP API for cross-venue margin data, agent performance, proof of reserves.',
};

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  pricing: string;
  exampleCurl: string;
  status: 'live' | 'pending';
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/margin/:user',
    summary: 'Plinth margin number for a wallet. Returns collateral, required margin, buying power, paused state.',
    pricing: '$0.001 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" \\\n     https://codex.atrium.fi/margin/0xYourWallet`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/positions/:user',
    summary: 'Open positions across every Portico-whitelisted venue. Includes notional, entry, mark (when oracle live), unrealised PnL.',
    pricing: '$0.001 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" \\\n     https://codex.atrium.fi/positions/0xYourWallet`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/risk/:user',
    summary: 'Per-venue risk decomposition. Maps each venue to its share of total required margin + haircut applied.',
    pricing: '$0.002 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" \\\n     https://codex.atrium.fi/risk/0xYourWallet`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/venues',
    summary: 'Live venue health table. Per-venue: deployed address, paused state, last oracle ts, notional cap remaining this block.',
    pricing: '$0.0005 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" https://codex.atrium.fi/venues`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/agents/:id/perf',
    summary: 'Agent performance snapshot. 7/30/90 day PnL, total actions, failure rate, deboost tier, mandate count.',
    pricing: '$0.001 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" https://codex.atrium.fi/agents/augur/perf`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/backtest/:strategy',
    summary: 'Replay a published ResearchAttestation backtest. Returns IPFS notebook URL + delta bps + trade count.',
    pricing: '$0.005 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" https://codex.atrium.fi/backtest/mean-reversion-v1`,
    status: 'pending',
  },
  {
    method: 'GET',
    path: '/attestation/:wallet',
    summary: 'Lantern proof-of-reserves Merkle proof for a wallet. Returns latest root + the inclusion path.',
    pricing: '$0.0005 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" \\\n     https://codex.atrium.fi/attestation/0xYourWallet`,
    status: 'live',
  },
  {
    method: 'GET',
    path: '/options/:symbol',
    summary: 'Stoa Black-Scholes Greeks for a tokenized option. Strike + expiry inferred from symbol.',
    pricing: '$0.002 per call',
    exampleCurl: `curl -H "X-PAYMENT: $X402_TOKEN" https://codex.atrium.fi/options/rTSLA-DEC25-180C`,
    status: 'pending',
  },
];

export default function CodexDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/docs" className="hover:text-ink">Docs</Link>
          <Link href="/brand" className="hover:text-ink">Brand</Link>
        </nav>
      </header>

      <section className="mt-16">
        <p className="eyebrow">Codex API</p>
        <h1 className="mt-2 font-display text-5xl italic text-ink">x402-payable . onchain queries</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          Codex is the read-side API surface for Atrium. Eight endpoints expose margin, positions,
          risk decomposition, venue health, agent performance, research backtests, proof-of-reserves
          attestations, and option Greeks. Every response is HMAC-signed via{' '}
          <code className="font-mono text-ink">X-Codex-Key-Id</code>; every request pays in USDC
          via{' '}
          <a href="https://x402.org" target="_blank" rel="noreferrer" className="underline">x402</a>.
        </p>
      </section>

      {/* Quickstart */}
      <Section title="Quickstart">
        <p className="text-sm text-ink-soft">
          Get an x402 payment token from your wallet, send it as the{' '}
          <code className="font-mono text-ink">X-PAYMENT</code> header. Codex verifies on-chain
          settlement before serving the response.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-mob-bg-card p-5 font-mono text-[12.5px] leading-[1.6] text-parchment">
{`# 1. Generate an x402 token via your wallet's x402 SDK
X402_TOKEN=$(./gen-x402.sh 0.001 0x...codex-address)

# 2. Call any Codex endpoint with the token
curl -H "X-PAYMENT: $X402_TOKEN" \\
     https://codex.atrium.fi/margin/0xYourWallet

# Response:
# {
#   "marginUsd": "12378422.00",
#   "requiredMarginUsd": "4759843.21",
#   "buyingPowerUsd": "7618578.79",
#   "paused": false,
#   "source": "plinth",
#   "asOfBlock": 270918668
# }
# Headers: X-Codex-Key-Id: 1
#          X-Codex-Signature: 0xabc...`}
        </pre>
      </Section>

      {/* Authentication */}
      <Section title="Authentication">
        <ul className="space-y-3 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">Payment</strong>: every endpoint requires an x402 USDC
            payment header. Missing or insufficient {'->'} 402 with the price quote in the body.
          </li>
          <li>
            <strong className="text-ink">Response signing</strong>: every response is HMAC-signed.
            Header <code className="font-mono">X-Codex-Signature</code> is the SHA256 HMAC of the
            response body; <code className="font-mono">X-Codex-Key-Id</code> is the rotation index
            so clients verify with the correct key.
          </li>
          <li>
            <strong className="text-ink">Idempotency</strong>: pass{' '}
            <code className="font-mono">X-Idempotency-Key</code> (any UUID) for safe retries on
            non-pure reads. Cached for 24h.
          </li>
          <li>
            <strong className="text-ink">Rate limits</strong>: 10 req/s per IP, 100 req/min per
            wallet, 1000 req/h per agent. Most restrictive applies. Hit a limit {'->'} 429 with
            <code className="font-mono">Retry-After</code> header.
          </li>
        </ul>
      </Section>

      {/* Endpoints */}
      <Section title="Endpoints">
        <div className="space-y-6">
          {ENDPOINTS.map((ep) => (
            <article key={ep.path} className="rounded-md border border-line bg-paper p-5">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <span
                    className={
                      'rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ' +
                      (ep.method === 'GET' ? 'bg-live-soft text-live' : 'bg-testnet/15 text-testnet')
                    }
                  >
                    {ep.method}
                  </span>
                  <code className="font-mono text-[15px] text-ink">{ep.path}</code>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                    {ep.pricing}
                  </span>
                  <span
                    className={
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ' +
                      (ep.status === 'live' ? 'bg-live-soft text-live' : 'bg-testnet/15 text-testnet')
                    }
                  >
                    <span className={'size-1.5 rounded-full ' + (ep.status === 'live' ? 'bg-live' : 'bg-testnet')} />
                    {ep.status}
                  </span>
                </div>
              </header>
              <p className="mt-3 text-sm text-ink-soft">{ep.summary}</p>
              <pre className="mt-3 overflow-x-auto rounded-md border border-divider bg-parchment-soft px-4 py-3 font-mono text-[12px] text-ink">
                {ep.exampleCurl}
              </pre>
            </article>
          ))}
        </div>
      </Section>

      {/* SDK */}
      <Section title="SDK snippets">
        <h3 className="text-sm font-medium text-ink">TypeScript (viem + x402)</h3>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-mob-bg-card p-4 font-mono text-[12.5px] leading-[1.6] text-parchment">
{`import { x402Sign } from '@x402/core';
import { createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http() });
const token = await x402Sign(wallet, { amountUsd: 0.001, recipient: CODEX_ADDR });
const res = await fetch('https://codex.atrium.fi/margin/' + userAddr, {
  headers: { 'X-PAYMENT': token },
});
const data = await res.json();`}
        </pre>

        <h3 className="mt-6 text-sm font-medium text-ink">Python (httpx + web3)</h3>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-mob-bg-card p-4 font-mono text-[12.5px] leading-[1.6] text-parchment">
{`from x402 import sign as x402_sign
import httpx

token = x402_sign(amount_usd=0.001, recipient=CODEX_ADDR, signer=wallet)
r = httpx.get(
    f'https://codex.atrium.fi/margin/{user_addr}',
    headers={'X-PAYMENT': token},
)
data = r.json()`}
        </pre>
      </Section>

      {/* Errors */}
      <Section title="Error codes">
        <ul className="space-y-2 text-sm text-ink-soft">
          <li><code className="font-mono text-ink">402</code>  missing or insufficient x402 payment; body has price quote</li>
          <li><code className="font-mono text-ink">429</code>  rate-limited; body has retry-after</li>
          <li><code className="font-mono text-ink">503</code>  upstream subgraph or RPC unavailable; honest pending</li>
          <li><code className="font-mono text-ink">404</code>  user / agent / strategy not found</li>
        </ul>
      </Section>

      <footer className="mt-16 border-t border-divider pt-6 text-xs text-muted">
        Codex source: <code className="font-mono text-ink">services/codex/</code> .
        Phase eta.8 docs page; live status pulled from{' '}
        <code className="font-mono">/api/codex/health</code> once that endpoint lands.
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
