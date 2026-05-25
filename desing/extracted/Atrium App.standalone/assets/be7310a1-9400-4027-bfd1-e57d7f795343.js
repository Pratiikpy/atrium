// Portfolio view — unified margin dashboard (Plinth)

const Portfolio = () => {
  const { POSITIONS, VENUES, ACTIVITY, fmtUSD, fmtPct, ME, shorten,
          StatCard, Icon, Tag, Spark, synthSpark, Avatar, AddressChip } = window;

  const [leverage, setLeverage] = React.useState(3.0);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1800);
    return () => clearInterval(t);
  }, []);

  const totalCollateral = React.useMemo(() =>
    VENUES.reduce((s, v) => s + v.collateral, 0)
    + Math.sin(tick * 0.6) * 12000,
    [tick]);

  const buyingPower = totalCollateral * leverage;
  const pnl24h = POSITIONS.reduce((s, p) => s + p.pnl24h, 0);
  const totalNotional = POSITIONS.reduce((s, p) => s + p.notional, 0);
  const utilization = (totalNotional / buyingPower) * 100;

  const sparkData = React.useMemo(() => synthSpark(7, 30, 0.18), []);

  // Live favicon — reflects Plinth margin health on the portfolio view
  React.useEffect(() => {
    const status = utilization < 60 ? "green"
                 : utilization < 85 ? "amber" : "red";
    window.setAtriumFavicon?.(status, true);
  }, [utilization]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Portfolio</div>
          <h1 className="view-title">Unified margin</h1>
          <div className="view-sub">
            <AddressChip address={ME.address} label="Wallet" />
            <span style={{ marginLeft: 8 }} className="muted">· {ME.ens}</span>
          </div>
        </div>
        <div className="view-actions">
          <a className="btn ghost" href="#transfer">
            <Icon name="transfer" size={14} /> Transfer
          </a>
          <a className="btn ghost" href="#agents">
            <Icon name="agents" size={14} /> Delegate
          </a>
          <a className="btn large" href="#trade">
            <Icon name="trade" size={14} /> Trade
          </a>
        </div>
      </div>

      {/* Top stats */}
      <div className="stat-grid mb-5">
        <StatCard
          label="Buying power"
          value={fmtUSD(buyingPower)}
          sub={`at ${leverage.toFixed(1)}× portfolio margin`}
        />
        <StatCard
          label="Total collateral"
          value={fmtUSD(totalCollateral)}
          sub="across 7 live venues"
        />
        <StatCard
          label="Open notional"
          value={fmtUSD(totalNotional)}
          sub={`${utilization.toFixed(1)}% utilisation`}
        />
        <StatCard
          label="P&L · 24h"
          value={fmtUSD(pnl24h, { signed: true })}
          sub={fmtPct(pnl24h / totalCollateral * 100) + " on collateral"}
          accent={pnl24h > 0}
        />
      </div>

      {/* Plinth health + Buying power curve */}
      <div className="grid-2 mb-5">
        <PlinthHealth
          leverage={leverage}
          setLeverage={setLeverage}
          utilization={utilization}
          buyingPower={buyingPower}
        />
        <BuyingPowerChart data={sparkData} value={buyingPower} />
      </div>

      {/* Positions + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <PositionsCard />
        <ActivityCard />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Plinth health — utilization + leverage slider                       */
/* ------------------------------------------------------------------ */

const PlinthHealth = ({ leverage, setLeverage, utilization, buyingPower }) => {
  const { Icon, fmtUSD } = window;
  const status = utilization < 60 ? "healthy" : utilization < 85 ? "warning" : "critical";
  const statusColor = status === "healthy" ? "var(--live)" : status === "warning" ? "oklch(60% 0.14 70)" : "var(--neg)";

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Plinth · margin health</div>
          <div className="muted small mt-2">SPAN-style portfolio margin · Rust → WASM</div>
        </div>
        <span className="tag green">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: statusColor }} />
          {status}
        </span>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="between-bl mb-2">
          <span className="cap">Utilisation</span>
          <span className="num" style={{ fontSize: 13.5 }}>{utilization.toFixed(1)}%</span>
        </div>
        <div className="util-bar">
          <div className="util-fill" style={{ width: `${Math.min(100, utilization)}%`, background: statusColor }} />
          <div className="util-marker" style={{ left: "60%" }} />
          <div className="util-marker warning" style={{ left: "85%" }} />
        </div>
        <div className="between mt-2 cap muted">
          <span>0%</span><span>60% · soft</span><span>85% · hard</span><span>100%</span>
        </div>
      </div>

      <div className="card-divider" />

      <div className="field" style={{ gap: 10 }}>
        <div className="between-bl">
          <label>Portfolio margin · leverage</label>
          <span className="num strong" style={{ fontSize: 14 }}>{leverage.toFixed(1)}×</span>
        </div>
        <input type="range" min="1" max="10" step="0.1"
          value={leverage}
          onChange={(e) => setLeverage(parseFloat(e.target.value))} />
        <div className="between cap muted"><span>1×</span><span>10×</span></div>
      </div>

      <div className="card-divider" />

      <div className="grid-2" style={{ gap: 12 }}>
        <div>
          <div className="cap">Headroom</div>
          <div className="num mt-2" style={{ fontSize: 18 }}>
            {fmtUSD(buyingPower * (1 - utilization / 100))}
          </div>
        </div>
        <div>
          <div className="cap">Liquidation buffer</div>
          <div className="num mt-2" style={{ fontSize: 18 }}>
            {(100 - utilization).toFixed(1)}% <span className="muted" style={{ fontSize: 12 }}>headroom</span>
          </div>
        </div>
      </div>

      <style>{`
        .util-bar {
          height: 8px; border-radius: 4px; background: var(--bg-sunk);
          position: relative; overflow: hidden;
        }
        .util-fill { height: 100%; border-radius: 4px; transition: width 600ms ease, background 200ms ease; }
        .util-marker {
          position: absolute; top: -2px; bottom: -2px; width: 1px;
          background: var(--ink-soft);
        }
        .util-marker.warning { background: oklch(60% 0.14 70); }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Buying power chart                                                  */
/* ------------------------------------------------------------------ */

const BuyingPowerChart = ({ data, value }) => {
  const { fmtUSD } = window;
  const w = 540, h = 168;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const path = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 12) - 6;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const last = data[data.length - 1];
  const lastX = w, lastY = h - ((last - min) / range) * (h - 12) - 6;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Buying power · 30 days</div>
          <div className="muted small mt-2">Plinth output, computed every block</div>
        </div>
        <div className="seg">
          <button>24h</button>
          <button>7d</button>
          <button className="on">30d</button>
          <button>90d</button>
        </div>
      </div>

      <div className="num" style={{ fontSize: 32, letterSpacing: "-0.022em", marginTop: 6 }}>
        {fmtUSD(value)}
      </div>
      <div className="mt-2 cap" style={{ color: "var(--live)" }}>+ $284,920 · 24h</div>

      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 168, marginTop: 14, display: "block" }}>
        <defs>
          <linearGradient id="bpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="var(--ink)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#bpfill)" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx={lastX - 2} cy={lastY} r="3" fill="var(--ink)" />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Positions table                                                     */
/* ------------------------------------------------------------------ */

const PositionsCard = () => {
  const { POSITIONS, VENUES, fmtUSD, fmtPct, Icon, Tag } = window;
  const [filter, setFilter] = React.useState("all");
  const venueOf = (id) => VENUES.find(v => v.id === id);

  const filtered = filter === "all"
    ? POSITIONS
    : POSITIONS.filter(p => venueOf(p.venue).chainShort === filter);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Open positions · {filtered.length}</div>
          <div className="muted small mt-2">Across {new Set(POSITIONS.map(p => p.venue)).size} venues</div>
        </div>
        <div className="seg">
          <button className={filter === "all" ? "on" : ""}    onClick={() => setFilter("all")}>All</button>
          <button className={filter === "arb-sepolia" ? "on" : ""} onClick={() => setFilter("arb-sepolia")}>Arbitrum</button>
          <button className={filter === "rh-chain" ? "on" : ""}    onClick={() => setFilter("rh-chain")}>RH-Chain</button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Venue</th>
            <th>Size</th>
            <th className="ar">Notional</th>
            <th className="ar">Entry · Mark</th>
            <th className="ar">P&amp;L · 24h</th>
            <th className="ar">Margin</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => {
            const v = venueOf(p.venue);
            const isShort = p.side === "short";
            const isSupply = p.side === "supply";
            return (
              <tr key={p.id}>
                <td className="strong">
                  <div className="mono">{p.instrument}</div>
                  <div className="muted cap mt-2" style={{ fontSize: 9.5 }}>
                    {isSupply ? "Supply" : `${p.side.toUpperCase()} · ${p.leverage}×`}
                  </div>
                </td>
                <td>
                  <div className="strong">{v.name}</div>
                  <div className="muted small">{v.chain}</div>
                </td>
                <td className="num">{p.size}</td>
                <td className="ar num strong">{fmtUSD(p.notional)}</td>
                <td className="ar num">
                  {p.entry < 100 ? p.entry.toFixed(4) : p.entry.toLocaleString()}
                  <span className="muted"> · {p.mark < 100 ? p.mark.toFixed(4) : p.mark.toLocaleString()}</span>
                </td>
                <td className={"ar num strong " + (p.pnl24h > 0 ? "pos" : "neg")}>
                  {fmtUSD(p.pnl24h, { signed: true })}
                  <div className={"small " + (p.pnl24h > 0 ? "pos" : "neg")} style={{ fontWeight: 400 }}>{fmtPct(p.pnlPct)}</div>
                </td>
                <td className="ar num">{p.margin ? fmtUSD(p.margin, { compact: true }) : <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

const ActivityCard = () => {
  const { ACTIVITY, Icon } = window;
  const iconOf = (k) => ({
    agent:    "agents",
    sigil:    "shield",
    deposit:  "transfer",
    vigil:    "shield",
    lantern:  "reserves",
    trade:    "trade",
    transfer: "transfer"
  })[k] || "info";

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 20px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Activity</div>
          <div className="muted small mt-2">Live feed from Scribe</div>
        </div>
        <span className="pill"><span className="dot" /> live</span>
      </div>

      <div style={{ padding: "4px 20px 20px" }}>
        {ACTIVITY.map((a, i) => (
          <div key={a.id} className="activity-row">
            <span className="act-icon"><Icon name={iconOf(a.kind)} size={13} /></span>
            <div className="col" style={{ gap: 3, minWidth: 0 }}>
              <div className="strong small">{a.desc}</div>
              <div className="muted mono" style={{ fontSize: 10.5 }}>
                {a.ts} · {a.hash}
              </div>
            </div>
            <div className={"mono small " + (a.ok ? "" : "neg")} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {a.value}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .activity-row {
          display: grid;
          grid-template-columns: 26px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .activity-row:last-child { border-bottom: none; }
        .act-icon {
          width: 26px; height: 26px; border-radius: 8px;
          background: var(--bg-sunk);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
};

window.Portfolio = Portfolio;
