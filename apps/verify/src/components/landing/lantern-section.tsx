import { SectionShell } from './section-shell';

export function LanternSection() {
  return (
    <SectionShell
      id="reserves"
      eyebrow="Proof of reserves · Lantern"
      headline={
        <>
          Every dollar, on the public{' '}
          <span
            className="font-serif italic"
            style={{
              color: '#7E2A20',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            record.
          </span>
        </>
      }
      sub="Lantern publishes a signed Merkle attestation every sixty minutes. Anyone can verify a balance against it locally, without trusting Atrium."
    >
      <MerkleTreeViz />
    </SectionShell>
  );
}

function MerkleTreeViz() {
  // simple deterministic 4-leaf merkle tree
  const leaves = ['0xa1…', '0xb2…', '0xc3…', '0xd4…'];
  return (
    <div className="mx-auto max-w-3xl">
      <svg
        viewBox="0 0 600 240"
        className="w-full"
        role="img"
        aria-label="Merkle tree diagram with a root, two internal H(a,b) and H(c,d) nodes, and four leaf hashes, the structure Lantern signs and publishes each hour"
      >
        {/* root */}
        <rect x="270" y="20" width="60" height="28" rx="6" fill="var(--color-ink)" />
        <text x="300" y="38" textAnchor="middle" fontSize="10" fontFamily="Geist Mono" fill="var(--color-parchment)">root</text>
        {/* internal */}
        <line x1="300" y1="48" x2="170" y2="88" stroke="currentColor" strokeWidth="0.5" className="text-muted" />
        <line x1="300" y1="48" x2="430" y2="88" stroke="currentColor" strokeWidth="0.5" className="text-muted" />
        <rect x="140" y="88" width="60" height="28" rx="6" fill="var(--color-parchment)" stroke="var(--color-divider)" />
        <text x="170" y="106" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" className="fill-ink-soft">H(a,b)</text>
        <rect x="400" y="88" width="60" height="28" rx="6" fill="var(--color-parchment)" stroke="var(--color-divider)" />
        <text x="430" y="106" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" className="fill-ink-soft">H(c,d)</text>
        {/* leaves */}
        {leaves.map((l, i) => {
          const x = 60 + i * 160;
          const parentX = i < 2 ? 170 : 430;
          return (
            <g key={l}>
              <line x1={parentX} y1="116" x2={x + 30} y2="156" stroke="currentColor" strokeWidth="0.5" className="text-muted" />
              <rect x={x} y="156" width="60" height="28" rx="6" fill="var(--color-parchment-soft)" stroke="var(--color-divider)" />
              <text x={x + 30} y="174" textAnchor="middle" fontSize="9" fontFamily="Geist Mono" className="fill-ink-soft">{l}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-4 text-center text-xs text-muted">Signed by Lantern on chain and verifiable now; the free scheduler refreshes it roughly hourly. IPFS pin and client-side inclusion proof light up with a web3.storage token.</p>
    </div>
  );
}
