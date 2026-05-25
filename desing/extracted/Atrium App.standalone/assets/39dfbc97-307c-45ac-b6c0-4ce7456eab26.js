// Reserves view — Lantern · proof-of-reserves

const Reserves = () => {
  const { VENUES, RECENT_RESERVES, fmtUSD, Icon, Tag, StatCard } = window;

  const total = VENUES.reduce((s, v) => s + v.collateral, 0);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Reserves · Lantern</div>
          <h1 className="view-title">Hourly proof-of-reserves</h1>
          <div className="view-sub">
            Atrium never custodies funds. Every hour Lantern publishes a signed Merkle attestation on Arbitrum Sepolia.
          </div>
        </div>
        <div className="view-actions">
          <a className="btn ghost" href="#">
            <Icon name="download" size={14} /> Verifier (14kb)
          </a>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <StatCard label="On-chain reserves" value={fmtUSD(total, { compact: true })} sub="Across 7 live venues" />
        <StatCard label="Reported liabilities" value={fmtUSD(total, { compact: true })} sub="0.00 bps delta" />
        <StatCard label="Last attestation" value="38m ago"          sub="Block #8,142,317" accent />
        <StatCard label="Independent verifications" value="2,140"   sub="Last 24h" />
      </div>

      <div className="grid-2 mb-5">
        <LatestAttestation />
        <MerkleVisual />
      </div>

      <AttestationsTable />
    </div>
  );
};

const LatestAttestation = () => {
  const { fmtUSD, Icon, VENUES } = window;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Latest attestation</div>
          <div className="muted small mt-2">Block #8,142,317 · 38 min ago · arb-sepolia</div>
        </div>
        <span className="tag green"><Icon name="check" size={11} /> verified</span>
      </div>

      <div className="att-grid">
        <div>
          <div className="cap">Merkle root</div>
          <div className="mono mt-2" style={{ fontSize: 12 }}>0xa72f4d8c1e2f9b3a5c4d6e8f9a1b2c3d4e5f6789abcdef0123456789abcdef91c4</div>
        </div>
        <div>
          <div className="cap">Attested at</div>
          <div className="mono mt-2" style={{ fontSize: 12 }}>2026-05-18 16:00:14 UTC</div>
        </div>
        <div>
          <div className="cap">Signed by</div>
          <div className="mono mt-2" style={{ fontSize: 12 }}>0x4f29…81e0 · Atrium Labs multisig (3 of 5)</div>
        </div>
      </div>

      <div className="card-divider" />

      <div className="cap mb-3">Per-venue reserves</div>
      <div className="att-list">
        {VENUES.map(v => {
          const pending = v.status === "pending";
          return (
            <div key={v.id} className="att-row" style={pending ? { opacity: 0.5 } : null}>
              <span className="mono small">{v.short}</span>
              <span className="muted small">{v.chain}</span>
              <span className="num strong">
                {pending ? <span className="muted">pending SDK</span> : fmtUSD(v.collateral, { compact: true })}
              </span>
              {pending
                ? <span className="tag amber" style={{ padding: "1px 6px", fontSize: 9.5 }}>soon</span>
                : <span className="tag green" style={{ padding: "1px 6px", fontSize: 9.5 }}>
                    <Icon name="check" size={9} /> ✓
                  </span>}
            </div>
          );
        })}
      </div>

      <style>{`
        .att-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
          margin-top: 14px;
        }
        @media (max-width: 700px) { .att-grid { grid-template-columns: 1fr; } }
        .att-list { display: flex; flex-direction: column; gap: 6px; }
        .att-row {
          display: grid; grid-template-columns: 90px 1fr auto auto;
          gap: 12px; align-items: center;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--bg-sunk);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

const MerkleVisual = () => {
  const { Icon } = window;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Merkle structure</div>
          <div className="muted small mt-2">Verify any leaf against root locally</div>
        </div>
        <a className="ulink small" href="#">View on Etherscan ↗</a>
      </div>

      <svg viewBox="0 0 540 220" width="100%" height="220" style={{ marginTop: 8 }}>
        <defs>
          <pattern id="dot" patternUnits="userSpaceOnUse" width="4" height="4">
            <circle cx="2" cy="2" r="0.5" fill="currentColor" opacity="0.2" />
          </pattern>
        </defs>
        {/* Root */}
        <g>
          <line x1="270" y1="30" x2="135" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <line x1="270" y1="30" x2="405" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <rect x="240" y="14" width="60" height="22" fill="var(--ink)" rx="4" />
          <text x="270" y="29" textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="var(--bg)">ROOT</text>
        </g>
        {/* Level 2 */}
        {[135, 405].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="100" x2={x - 65} y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1={x} y1="100" x2={x + 65} y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <circle cx={x} cy="90" r="6" fill="var(--ink-soft)" />
          </g>
        ))}
        {/* Level 3 (4 nodes) */}
        {[70, 200, 340, 470].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="160" x2={x - 22} y2="195" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1={x} y1="160" x2={x + 22} y2="195" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <circle cx={x} cy="150" r="4.5" fill="var(--ink-soft)" />
          </g>
        ))}
        {/* Leaves (8 nodes) */}
        {window.VENUES.map((v, i) => {
          const x = 48 + i * 65;
          return (
            <g key={v.id}>
              <rect x={x - 18} y="200" width="36" height="14" fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth="0.5" rx="2" />
              <text x={x} y="210" textAnchor="middle" fontFamily="var(--mono)" fontSize="7.5" fill="var(--ink-soft)">{v.short.slice(0, 6)}</text>
            </g>
          );
        })}
      </svg>

      <div className="cap muted mt-4" style={{ lineHeight: 1.6 }}>
        Eight per-venue leaves. The verifier ships as a 14kb static HTML file —
        save it and verify offline, without trusting Atrium's servers.
      </div>
    </div>
  );
};

const AttestationsTable = () => {
  const { RECENT_RESERVES, Icon, Tag } = window;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
        <div className="card-title">Recent attestations</div>
        <div className="seg">
          <button className="on">24h</button>
          <button>7d</button>
          <button>30d</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Block</th>
            <th>Time</th>
            <th>Merkle root</th>
            <th>Δ reserves vs liabilities</th>
            <th className="ar" style={{ width: 120 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {RECENT_RESERVES.map((r, i) => (
            <tr key={i}>
              <td className="strong mono">#{r.block.toLocaleString()}</td>
              <td className="mono small">{r.time}</td>
              <td className="mono small">{r.root}</td>
              <td className={"mono small " + (r.delta.startsWith("+") || r.delta === "0.00 bps" ? "" : "neg")}>
                {r.delta}
              </td>
              <td className="ar">
                <span className="tag green"><Icon name="check" size={11} /> verified</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

window.Reserves = Reserves;
