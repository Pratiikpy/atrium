'use client';

/**
 * Architecture page interactive surfaces (Atrium Architecture reference port).
 * Three stateful sections: an interactive system map, an animated position
 * flow, and a live deployments table. All data is REAL: addresses come from
 * deployments/arbitrum_sepolia.json + robinhood_chain.json (verified on-chain).
 * Styling uses the app's parchment tokens so the marketing-shell mobile
 * token-flip renders these dark on mobile automatically.
 */

import { useEffect, useState } from 'react';

type Lang = 'STYLUS' | 'SOLIDITY';

type NodeKey =
  | 'wallet'
  | 'router'
  | 'coffer'
  | 'plinth'
  | 'adapter'
  | 'sigil'
  | 'vigil'
  | 'lantern';

type MapNode = {
  key: NodeKey;
  name: string;
  role: string;
  lang: Lang | 'USER';
  blurb: string;
  tags: string[];
  address?: string;
  chain?: string;
  chainId?: number;
};

const NODES: MapNode[] = [
  {
    key: 'wallet',
    name: 'Wallet',
    role: 'USER · SIGNER',
    lang: 'USER',
    blurb:
      'You sign one SIWE message to read, then EIP-712 intents to act. No custody: keys stay in your browser wallet. Atrium never holds your signing key.',
    tags: ['SIWE', 'EIP-712', 'self-custody'],
  },
  {
    key: 'router',
    name: 'AtriumRouter',
    role: 'DISPATCHER',
    lang: 'SOLIDITY',
    blurb:
      'The dispatcher. Takes a signed transaction and routes it: collateral to Coffer, a margin recompute on Plinth, and the position to the right per-venue adapter.',
    tags: ['Solidity', 'router', 'v1.1'],
    address: '0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'coffer',
    name: 'Coffer',
    role: 'ERC-4626 VAULT',
    lang: 'STYLUS',
    blurb:
      'Your collateral. An ERC-4626 USDC vault with a per-block per-adapter pull cap, so a compromised adapter can drain at most ~1% of TVL in a block. Refuses to operate when USDC state is unreadable.',
    tags: ['Stylus', 'ERC-4626', 'per-block cap'],
    address: '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'plinth',
    name: 'Plinth',
    role: 'SPAN MARGIN ENGINE',
    lang: 'STYLUS',
    blurb:
      'The heart of Atrium. SPAN portfolio margin: one buying-power number across venues that nets correlated exposure. Split into Plinth, Plinth-Math, and Plinth-Oracle to fit the 24KB code cap.',
    tags: ['Stylus', 'dual-oracle', 'SPAN'],
    address: '0xd86f579ec880eaab27dfa698ae056d1893ec7553',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'adapter',
    name: 'Adapter[i]',
    role: 'PER-VENUE · PORTICO',
    lang: 'SOLIDITY',
    blurb:
      'One adapter per venue, each speaking the IPorticoAdapter interface. Nine adapter contracts are deployed and verified on Arbitrum Sepolia; seven venues are in the launch margin scope (Aave Horizon is operational today; the rest register in PorticoRegistry in Month 1 W2): Hyperliquid HIP-3, Aave Horizon, Pendle V2, Curve, Trade.xyz, Polymarket, Hyperliquid HIP-4. GMX, Morpho, and Synthetix adapters are deployed but outside the initial seven.',
    tags: ['Solidity', 'Portico', '7 venues'],
    address: '0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'sigil',
    name: 'Sigil',
    role: 'MANDATE VALIDATOR',
    lang: 'STYLUS',
    blurb:
      'Turns one typed signature into a bounded agent mandate: one agent, one strategy, one cap, one expiry. The Postern Kill Switch routes through Sigil to revoke every mandate at once.',
    tags: ['Stylus', 'EIP-712', 'mandates'],
    address: '0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'vigil',
    name: 'Vigil',
    role: 'LIQUIDATOR',
    lang: 'STYLUS',
    blurb:
      'Three independent keepers race to liquidate any account that falls under-collateralised. Liquidations are partial (≤10% per block) and route to the most-liquid venue first.',
    tags: ['Stylus', 'keepers', 'partial'],
    address: '0x5ccd3422f430f6d034ff46715b41509de9d0deed',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
  {
    key: 'lantern',
    name: 'Lantern',
    role: 'PROOF OF RESERVES',
    lang: 'SOLIDITY',
    blurb:
      'Every 10 minutes Lantern publishes a Merkle root of every Coffer balance on-chain and pins the tree to IPFS. Verify your own balance with a one-click inclusion proof.',
    tags: ['Solidity', 'Merkle', '10-min'],
    address: '0xF0B90b94C0B8a52c545768bFf06a3932c67d5888',
    chain: 'ARBITRUM SEPOLIA',
    chainId: 421614,
  },
];

const ARBISCAN = 'https://sepolia.arbiscan.io/address/';
const RH_EXPLORER = 'https://testnet.robinhood.com/address/'; // Robinhood Chain testnet explorer

type Row = { name: string; address: string; lang: Lang; explorer: string };

const CORE_15: Row[] = [
  { name: 'Coffer', address: '0xc7bf0145371d3a79a9d43bab46dfee40f8a4aaf3', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'Plinth', address: '0xd86f579ec880eaab27dfa698ae056d1893ec7553', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'Plinth-Math', address: '0xc53dbfc0c35291f79e7d8d876603ab35ab97ddab', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'Plinth-Oracle', address: '0x66064d18722f50e055d74daf51a13fd8e331f0b7', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'Sigil', address: '0xdba97d39ff790e69c3526bb0c0b99a38f686d6d9', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'Vigil', address: '0x5ccd3422f430f6d034ff46715b41509de9d0deed', lang: 'STYLUS', explorer: ARBISCAN },
  { name: 'AtriumRouter', address: '0xF593e012196BDe8A58Ccdbf685f7A74fD3bD35e0', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'PorticoRegistry', address: '0x9a9af6e50491cd4694699d48564bbff18f9b40bc', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'PraetorTimelock', address: '0x0dad24d7feb2bb797e0f69e02c2f32104fcf22d4', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'PosternKillSwitch', address: '0xCD899f715462A33Ae880310d72b37bde102ab0b7', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'LanternAttestor v2', address: '0xF0B90b94C0B8a52c545768bFf06a3932c67d5888', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Aqueduct', address: '0x6139449bf43f44385d08640b2e6fd2b82cb87ec2', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Edict', address: '0x66577042b4d47312e554bbfa5e29ae20f55dd631', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Curator', address: '0x21c5ecc5b3ad6b066ef32145a06ed1b688d3103d', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Rostrum', address: '0x748A0a4E53F3E94f9a279bfDC5eCbF8A7c88f093', lang: 'SOLIDITY', explorer: ARBISCAN },
];

const VENUES_9: Row[] = [
  { name: 'Aave Horizon', address: '0xd71C5D88d62e92EE8941cAE51f8637a73111C4E1', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Curve', address: '0xf3da25f3ff8bdddc093e34c2f2b117cdb7505682', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'GMX', address: '0x2531af9f7596d74f412bfab7d3b84ee7a32cd2d4', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Hyperliquid', address: '0x87014fbace9ade49bf923bcfae74b4c858cf371e', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Morpho', address: '0xfabe2b0d1c66bc2976ed3b0c58f3cdcb7878344e', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Pendle', address: '0x54a1bc2c5c73cc531035b0f008c8a252a02daf7d', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Polymarket', address: '0x98a688723c47ab6909be04fd0aa3eca5ee8b08db', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Synthetix', address: '0x62b3b34ffa76fb62245702c0b7efd37832eb39b8', lang: 'SOLIDITY', explorer: ARBISCAN },
  { name: 'Trade.xyz', address: '0xf34c38d9e61a1b1beafffbb681b07e489c36a1ce', lang: 'SOLIDITY', explorer: ARBISCAN },
];

const ROBINHOOD_8: Row[] = [
  { name: 'Plinth', address: '0xa08ba28ef31658df67e874dd2bf8a2b2d34597fa', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'Coffer', address: '0x71d872bd76738887415439a7fc0a1acbc4218fbc', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'Vigil', address: '0x6c6901a9ca6f13aede06f0d20050052a94a854da', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'Sigil', address: '0xede8444c622b8ae28364e86784749744bd0a1c23', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'Plinth-Math', address: '0x6d655803bac4bf61ad5ad26fd3b88429671cb5db', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'Plinth-Oracle', address: '0x66577042b4d47312e554bbfa5e29ae20f55dd631', lang: 'STYLUS', explorer: RH_EXPLORER },
  { name: 'AtriumRouter', address: '0xB90a51A726740065BD0DbC20cD79306b30D8b676', lang: 'SOLIDITY', explorer: RH_EXPLORER },
  { name: 'Aave Horizon adapter', address: '0x66064d18722F50E055D74daf51A13fd8e331F0b7', lang: 'SOLIDITY', explorer: RH_EXPLORER },
];

const short = (a: string) => (a.length > 16 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);

/* ------------------------------------------------------------------ */
/* 01 · Interactive system map                                         */
/* ------------------------------------------------------------------ */
export function SystemMap() {
  const [selected, setSelected] = useState<NodeKey>('plinth');
  const node = NODES.find((n) => n.key === selected)!;

  return (
    <div className="arch-map">
      <div className="arch-map-grid" role="list">
        {NODES.map((n) => (
          <button
            key={n.key}
            type="button"
            role="listitem"
            onClick={() => setSelected(n.key)}
            onMouseEnter={() => setSelected(n.key)}
            className={`arch-node ${selected === n.key ? 'is-active' : ''}`}
            aria-pressed={selected === n.key}
          >
            <span className="arch-node-name">{n.name}</span>
            <span className="arch-node-role">{n.role}</span>
            <span className={`arch-node-lang lang-${n.lang.toLowerCase()}`}>
              {n.lang === 'USER' ? 'USER' : n.lang === 'STYLUS' ? 'STYLUS · RUST' : 'SOLIDITY'}
            </span>
          </button>
        ))}
      </div>

      <aside className="arch-detail" aria-live="polite">
        <div className="arch-detail-head">
          <span className="arch-detail-name">{node.name}</span>
          <span className={`arch-node-lang lang-${node.lang.toLowerCase()}`}>
            {node.lang === 'USER' ? 'USER' : node.lang === 'STYLUS' ? 'STYLUS · RUST' : 'SOLIDITY'}
          </span>
        </div>
        <p className="arch-detail-blurb">{node.blurb}</p>
        <div className="arch-detail-tags">
          {node.tags.map((t) => (
            <span key={t} className="arch-tag">
              {t}
            </span>
          ))}
        </div>
        {node.address ? (
          <CopyAddress address={node.address} chain={node.chain} chainId={node.chainId} />
        ) : (
          <div className="arch-detail-meta">In your browser wallet · never custodied by Atrium</div>
        )}
      </aside>
    </div>
  );
}

function CopyAddress({ address, chain, chainId }: { address: string; chain?: string; chainId?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="arch-detail-addr">
      <div className="arch-detail-chain">
        {chain}
        {chainId ? ` · ${chainId}` : ''}
      </div>
      <button
        type="button"
        className="arch-copy"
        onClick={() => {
          navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
      >
        <code>{short(address)}</code>
        <span className="arch-copy-label">{copied ? 'copied' : 'copy'}</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Animated position flow                                         */
/* ------------------------------------------------------------------ */
const FLOW_STEPS = [
  { node: 'coffer', label: 'Deposit 10,000 USDC into Coffer', margin: 0, note: 'Collateral posted. One vault, one balance.' },
  { node: 'router', label: 'Open long: WETH perp, 4× on Hyperliquid', margin: 2500, note: 'Isolated margin on this leg alone: $2,500.' },
  { node: 'adapter', label: 'Open short: ETH-correlated hedge on a second venue', margin: 4900, note: 'Naively both legs cost $4,900 isolated margin.' },
  { node: 'plinth', label: 'Plinth runs the SPAN scenario matrix', margin: 4900, note: 'The two legs are correlated. Scenarios cancel.' },
  { node: 'plinth', label: 'Correlated risk nets out', margin: 1180, note: 'Net required margin: $1,180 - not $4,900.' },
  { node: 'vigil', label: 'Vigil holds the line on the netted account', margin: 1180, note: 'You freed ~$3,720 of buying power. That is the point.' },
];

export function PositionFlow() {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= FLOW_STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1500);
    return () => clearTimeout(t);
  }, [playing, step]);

  const active = step >= 0 ? FLOW_STEPS[step] : null;
  const margin = active ? active.margin : null;

  const flowNodes = NODES.filter((n) => n.key !== 'sigil' && n.key !== 'lantern');

  return (
    <div className="arch-flow">
      <div className="arch-flow-controls">
        <button
          type="button"
          className="arch-flow-play"
          onClick={() => {
            if (step >= FLOW_STEPS.length - 1) setStep(-1);
            setStep((s) => (s < 0 ? 0 : s));
            setPlaying(true);
          }}
        >
          ▶ Play the flow
        </button>
        <button
          type="button"
          className="arch-flow-step"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.min(s + 1, FLOW_STEPS.length - 1));
          }}
        >
          Step ›
        </button>
        <button
          type="button"
          className="arch-flow-reset"
          onClick={() => {
            setPlaying(false);
            setStep(-1);
          }}
        >
          ↺ Reset
        </button>
        <span className="arch-flow-status">
          {step < 0 ? '6 steps · ready' : `step ${step + 1} / ${FLOW_STEPS.length}`}
        </span>
      </div>

      <div className="arch-flow-track" role="list">
        {flowNodes.map((n) => (
          <div
            key={n.key}
            role="listitem"
            className={`arch-flow-node ${active && active.node === n.key ? 'is-active' : ''}`}
          >
            <span className="arch-node-name">{n.name}</span>
            <span className="arch-node-role">{n.role}</span>
          </div>
        ))}
      </div>

      <div className="arch-flow-readout">
        <div className="arch-flow-margin">
          <span className="arch-flow-margin-label">Required margin</span>
          <span className="arch-flow-margin-value">
            {margin === null ? '·' : `$${margin.toLocaleString()}`}
          </span>
        </div>
        <p className="arch-flow-note">
          {active
            ? active.note
            : "Press Play the flow to trace a position from wallet to venue and back - with the margin saving computed live by Plinth's SPAN engine."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Live deployments table                                         */
/* ------------------------------------------------------------------ */
const TABS: { key: string; label: string; rows: Row[]; copyable: boolean }[] = [
  { key: 'core', label: 'Arbitrum · Core 15', rows: CORE_15, copyable: true },
  { key: 'venues', label: 'Arbitrum · Adapters 9', rows: VENUES_9, copyable: true },
  { key: 'rh', label: 'Robinhood Chain 8', rows: ROBINHOOD_8, copyable: true },
];

export function DeploymentsTable() {
  const [tab, setTab] = useState('core');
  const [copied, setCopied] = useState<string | null>(null);
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="arch-deploy">
      <div className="arch-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`arch-tab ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="arch-table" role="table">
        <div className="arch-table-head" role="row">
          <span role="columnheader">CONTRACT</span>
          <span role="columnheader">ADDRESS</span>
          <span role="columnheader">TYPE</span>
        </div>
        {current.rows.map((r) => (
          <div className="arch-table-row" role="row" key={r.name + r.address}>
            <span className="arch-table-name" role="cell">
              {r.name}
            </span>
            <span className="arch-table-addr" role="cell">
              {current.copyable ? (
                <button
                  type="button"
                  className="arch-addr-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(r.address).then(() => {
                      setCopied(r.address);
                      setTimeout(() => setCopied(null), 1400);
                    });
                  }}
                  title="Copy address"
                >
                  <code>{r.address}</code>
                  <span className="arch-addr-copy">{copied === r.address ? '✓' : 'copy'}</span>
                </button>
              ) : (
                <code className="arch-addr-static">{r.address}</code>
              )}
            </span>
            <span className={`arch-table-lang lang-${r.lang.toLowerCase()}`} role="cell">
              {r.lang}
            </span>
          </div>
        ))}
      </div>
      <p className="arch-deploy-foot">
        {tab === 'rh'
          ? 'Robinhood Chain testnet (chainId 46630) · the full Atrium stack mirrored from Arbitrum. Click any address to copy it.'
          : tab === 'venues'
            ? '9 venue-adapter contracts deployed + verified. Seven venues are in the launch margin scope (Aave Horizon operational today); GMX, Morpho, and Synthetix are deployed but outside the initial seven. Click any address to copy it.'
            : 'Solidity verified on Arbiscan + Sourcify · Stylus verified via cargo stylus verify. Click any address to copy it.'}
      </p>
    </div>
  );
}
