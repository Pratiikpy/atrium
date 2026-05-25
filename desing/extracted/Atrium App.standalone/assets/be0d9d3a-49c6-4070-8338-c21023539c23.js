// Trade view — Portico venue execution

const Trade = () => {
  const { VENUES, fmtUSD, fmtPct, Icon, Tag } = window;
  const [venueId, setVenueId] = React.useState("hl3");
  const [side, setSide]       = React.useState("long");
  const [orderType, setOrderType] = React.useState("market");
  const [size, setSize]       = React.useState("1200");
  const [leverage, setLev]    = React.useState(4);
  const [limitPx, setLimit]   = React.useState("251.40");

  const venue = VENUES.find(v => v.id === venueId);

  const mark = 251.10;
  const notional = parseFloat(size || 0) * mark;
  const margin = notional / leverage;
  const fee = notional * 0.0006;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Trade · Portico</div>
          <h1 className="view-title">Execute across eight venues</h1>
          <div className="view-sub">
            One signature opens, adjusts, or closes a position on any registered Portico adapter.
          </div>
        </div>
        <div className="view-actions">
          <a className="btn ghost" href="#portfolio">
            <Icon name="portfolio" size={14} /> Portfolio
          </a>
        </div>
      </div>

      {/* Venue selector */}
      <VenuePicker venueId={venueId} setVenueId={setVenueId} />

      {/* Main split: order entry · market · margin impact */}
      <div className="trade-grid mt-6">
        <OrderEntry
          venue={venue}
          side={side} setSide={setSide}
          orderType={orderType} setOrderType={setOrderType}
          size={size} setSize={setSize}
          leverage={leverage} setLev={setLev}
          limitPx={limitPx} setLimit={setLimit}
          notional={notional} margin={margin} fee={fee}
        />
        <MarketCard venue={venue} mark={mark} />
        <ImpactCard venue={venue} notional={notional} margin={margin} fee={fee} leverage={leverage} side={side} />
      </div>

      <style>{`
        .trade-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.15fr) minmax(0, 0.95fr);
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 1200px) {
          .trade-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

const VenuePicker = ({ venueId, setVenueId }) => {
  const { VENUES, Icon, fmtUSD } = window;
  return (
    <div className="venue-strip">
      {VENUES.map(v => {
        const active = venueId === v.id;
        const isPending = v.status === "pending";
        return (
          <button key={v.id} onClick={() => isPending ? null : setVenueId(v.id)}
            disabled={isPending}
            className={"venue-pick" + (active ? " active" : "") + (isPending ? " pending" : "")}>
            <div className="between-bl">
              <span className="strong">{v.short}</span>
              {active && <Icon name="check" size={13} />}
              {isPending && <span className="mono cap" style={{ fontSize: 9.5, color: "var(--muted)" }}>soon</span>}
            </div>
            <div className="muted small mt-2">{v.type}</div>
            <div className="num mt-2" style={{ fontSize: 14 }}>
              {isPending ? <span className="muted">—</span> : fmtUSD(v.collateral, { compact: true })}
            </div>
          </button>
        );
      })}
      <style>{`
        .venue-strip {
          display: grid; grid-template-columns: repeat(8, 1fr);
          gap: 8px;
        }
        @media (max-width: 1200px) { .venue-strip { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 700px)  { .venue-strip { grid-template-columns: repeat(2, 1fr); } }
        .venue-pick {
          padding: 12px 14px;
          border: 1px solid var(--line);
          background: var(--bg-raised);
          border-radius: 10px;
          text-align: left;
          cursor: pointer;
          font-family: var(--sans);
          color: var(--ink-soft);
          transition: border-color 120ms ease, transform 120ms ease;
        }
        .venue-pick:hover { border-color: var(--ink); }
        .venue-pick.active {
          border-color: var(--ink); background: var(--bg);
          box-shadow: 0 0 0 1px var(--ink) inset;
        }
        .venue-pick.pending {
          opacity: 0.55; cursor: not-allowed;
          background: var(--bg-sunk);
        }
        .venue-pick.pending:hover { border-color: var(--line); }
      `}</style>
    </div>
  );
};

const OrderEntry = ({ venue, side, setSide, orderType, setOrderType,
                     size, setSize, leverage, setLev, limitPx, setLimit,
                     notional, margin, fee }) => {
  const { fmtUSD, Icon } = window;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Order · {venue.short}</div>
        <span className="tag">{venue.chain}</span>
      </div>

      {/* Side */}
      <div className="seg" style={{ width: "100%" }}>
        <button className={side === "long" ? "on" : ""} onClick={() => setSide("long")}
                style={{ flex: 1, ...(side === "long" ? { color: "var(--live)" } : {}) }}>
          Long
        </button>
        <button className={side === "short" ? "on" : ""} onClick={() => setSide("short")}
                style={{ flex: 1, ...(side === "short" ? { color: "var(--neg)" } : {}) }}>
          Short
        </button>
      </div>

      {/* Order type */}
      <div className="seg mt-4" style={{ width: "100%" }}>
        <button className={orderType === "market" ? "on" : ""} onClick={() => setOrderType("market")} style={{ flex: 1 }}>Market</button>
        <button className={orderType === "limit"  ? "on" : ""} onClick={() => setOrderType("limit")}  style={{ flex: 1 }}>Limit</button>
        <button className={orderType === "stop"   ? "on" : ""} onClick={() => setOrderType("stop")}   style={{ flex: 1 }}>Stop</button>
      </div>

      <div className="field mt-4">
        <label>Size · contracts</label>
        <input className="input num-input" value={size}
               onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>

      {orderType !== "market" && (
        <div className="field mt-3">
          <label>{orderType === "stop" ? "Stop trigger" : "Limit price"}</label>
          <input className="input" value={limitPx} onChange={(e) => setLimit(e.target.value)} />
        </div>
      )}

      <div className="field mt-4">
        <div className="between-bl mb-2">
          <label>Leverage</label>
          <span className="num strong" style={{ fontSize: 13 }}>{leverage}×</span>
        </div>
        <input type="range" min="1" max="10" step="1" value={leverage}
               onChange={(e) => setLev(parseInt(e.target.value))} />
        <div className="between cap muted"><span>1×</span><span>10×</span></div>
      </div>

      <div className="card-divider" />

      <div className="kv">
        <div><span>Notional</span><span className="num">{fmtUSD(notional)}</span></div>
        <div><span>Initial margin</span><span className="num">{fmtUSD(margin)}</span></div>
        <div><span>Estimated fee</span><span className="num">{fmtUSD(fee, { decimals: 2 })}</span></div>
        <div><span>Slippage tolerance</span><span className="num">0.10%</span></div>
      </div>

      <button className="btn large mt-5" style={{ width: "100%", justifyContent: "center",
              background: side === "long" ? "var(--live)" : "var(--neg)",
              borderColor: side === "long" ? "var(--live)" : "var(--neg)" }}>
        {side === "long" ? "Open long" : "Open short"} · {orderType}
      </button>
      <div className="cap muted mt-3" style={{ textAlign: "center" }}>
        One signature · Plinth verifies cross-product margin onchain
      </div>

      <style>{`
        .kv {
          display: flex; flex-direction: column; gap: 8px;
          font-size: 13px;
        }
        .kv > div {
          display: flex; justify-content: space-between;
          color: var(--ink-soft);
        }
        .kv .num { color: var(--ink); }
      `}</style>
    </div>
  );
};

const MarketCard = ({ venue, mark }) => {
  const { Icon } = window;
  // Synthetic order book
  const bids = [
    { px: 251.08, sz: 1820, total: 1820 },
    { px: 251.04, sz: 2420, total: 4240 },
    { px: 251.00, sz: 1140, total: 5380 },
    { px: 250.96, sz: 3120, total: 8500 },
    { px: 250.92, sz:  840, total: 9340 },
    { px: 250.88, sz: 2210, total: 11550 }
  ];
  const asks = [
    { px: 251.14, sz: 1640, total: 1640 },
    { px: 251.18, sz: 2120, total: 3760 },
    { px: 251.22, sz: 1840, total: 5600 },
    { px: 251.28, sz: 2950, total: 8550 },
    { px: 251.34, sz:  920, total: 9470 },
    { px: 251.40, sz: 1740, total: 11210 }
  ].reverse();
  const maxTotal = Math.max(...bids.concat(asks).map(o => o.total));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">rTSLA-PERP</div>
          <div className="muted small mt-2">{venue.name}</div>
        </div>
        <div className="ar">
          <div className="num strong" style={{ fontSize: 18 }}>{mark.toFixed(2)}</div>
          <div className="pos small mono">+ 1.13% · 24h</div>
        </div>
      </div>

      <table className="ob">
        <tbody>
          {asks.map((o, i) => (
            <tr key={"a"+i} className="ask">
              <td className="num">{o.px.toFixed(2)}</td>
              <td className="num ar">{o.sz.toLocaleString()}</td>
              <td className="num ar muted">{o.total.toLocaleString()}</td>
              <td><span className="bar" style={{ width: `${(o.total / maxTotal) * 100}%` }} /></td>
            </tr>
          ))}
          <tr className="mid">
            <td colSpan="4" className="num strong">{mark.toFixed(2)} <span className="muted small">· spread 0.06</span></td>
          </tr>
          {bids.map((o, i) => (
            <tr key={"b"+i} className="bid">
              <td className="num">{o.px.toFixed(2)}</td>
              <td className="num ar">{o.sz.toLocaleString()}</td>
              <td className="num ar muted">{o.total.toLocaleString()}</td>
              <td><span className="bar" style={{ width: `${(o.total / maxTotal) * 100}%` }} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .ob {
          width: 100%; border-collapse: collapse; margin-top: 16px;
          font-family: var(--mono); font-size: 11.5px;
        }
        .ob td { padding: 4px 8px; position: relative; }
        .ob .ask td { color: var(--neg); }
        .ob .bid td { color: var(--live); }
        .ob .ask td:last-child, .ob .bid td:last-child { width: 30%; }
        .ob .ar { text-align: right; }
        .ob .muted { color: var(--muted); }
        .ob .strong { color: var(--ink); font-weight: 500; }
        .ob .bar {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          height: 14px; opacity: 0.12; border-radius: 2px;
        }
        .ob .ask .bar { background: var(--neg); }
        .ob .bid .bar { background: var(--live); }
        .ob .mid td {
          padding: 8px; text-align: center;
          background: var(--bg-sunk);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};

const ImpactCard = ({ venue, notional, margin, fee, leverage, side }) => {
  const { fmtUSD, fmtPct, Icon } = window;
  const beforeBP = 12378422;
  const afterBP  = beforeBP - margin;
  const utilBefore = 38.4;
  const utilAfter = utilBefore + (notional / beforeBP * 100);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Margin impact</div>
          <div className="muted small mt-2">Plinth · pre-execution</div>
        </div>
        <span className="tag green"><Icon name="check" size={11} /> Within mandate</span>
      </div>

      <div className="impact-row">
        <div className="cap">Buying power</div>
        <div className="impact-vals">
          <div className="impact-before num">{fmtUSD(beforeBP, { compact: true })}</div>
          <Icon name="arrow" size={12} />
          <div className="impact-after num strong">{fmtUSD(afterBP, { compact: true })}</div>
        </div>
      </div>

      <div className="impact-row">
        <div className="cap">Utilisation</div>
        <div className="impact-vals">
          <div className="impact-before num">{utilBefore.toFixed(1)}%</div>
          <Icon name="arrow" size={12} />
          <div className="impact-after num strong">{utilAfter.toFixed(1)}%</div>
        </div>
      </div>

      <div className="impact-row">
        <div className="cap">Liquidation price</div>
        <div className="impact-vals">
          <div className="impact-before muted">—</div>
          <Icon name="arrow" size={12} />
          <div className="impact-after num strong">
            {side === "long" ? "228.40" : "274.20"}
          </div>
        </div>
      </div>

      <div className="card-divider" />

      <div className="kv">
        <div><span>Position</span><span className="num strong">{side.toUpperCase()} · {leverage}× · {fmtUSD(notional, { compact: true })}</span></div>
        <div><span>Initial margin</span><span className="num">{fmtUSD(margin)}</span></div>
        <div><span>Maintenance margin</span><span className="num">{fmtUSD(margin * 0.5)}</span></div>
        <div><span>Fees</span><span className="num">{fmtUSD(fee, { decimals: 2 })} · taker 6 bps</span></div>
        <div><span>Gas · arb-sepolia</span><span className="num">$0.00 · sponsored</span></div>
      </div>

      <div className="card-divider" />

      <div className="cap muted" style={{ lineHeight: 1.6 }}>
        Order is checked against your Plinth headroom and any active Sigil mandate before signing.
        Vigil monitors the position every block.
      </div>

      <style>{`
        .impact-row {
          display: grid; grid-template-columns: auto 1fr;
          gap: 12px; align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .impact-row:last-child { border-bottom: none; }
        .impact-vals {
          display: flex; align-items: center; gap: 10px;
          justify-content: flex-end;
          color: var(--muted);
        }
        .impact-before { color: var(--muted); }
        .impact-after { color: var(--ink); }
        .kv {
          display: flex; flex-direction: column; gap: 8px;
          font-size: 13px;
        }
        .kv > div { display: flex; justify-content: space-between; color: var(--ink-soft); }
        .kv .num { color: var(--ink); }
      `}</style>
    </div>
  );
};

window.Trade = Trade;
