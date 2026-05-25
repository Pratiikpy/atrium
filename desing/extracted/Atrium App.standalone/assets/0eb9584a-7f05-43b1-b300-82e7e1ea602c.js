// Tax view — Tablet · UK / US / DE exports

const Tax = () => {
  const { TAX_LOTS, fmtUSD, Icon, Tag, StatCard } = window;
  const [jurisdiction, setJurisdiction] = React.useState("UK");
  const [year, setYear] = React.useState("2026");

  const totalGain = TAX_LOTS.reduce((s, l) => s + l.gain, 0);
  const totalProceeds = TAX_LOTS.reduce((s, l) => s + l.proceeds, 0);

  const formByJurisdiction = {
    UK: "CGT · SA108",
    US: "Form 8949",
    DE: "FIFO § 23 EStG"
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Tax · Tablet</div>
          <h1 className="view-title">Realised gains, by jurisdiction</h1>
          <div className="view-sub">
            Atrium computes your cost basis across every venue using the relevant jurisdiction's accounting method.
            Export signed by a Lantern Merkle root for auditor verification.
          </div>
        </div>
        <div className="view-actions">
          <button className="btn ghost"><Icon name="download" size={14} /> CSV</button>
          <button className="btn ghost"><Icon name="download" size={14} /> PDF</button>
          <button className="btn"><Icon name="download" size={14} /> Signed export</button>
        </div>
      </div>

      {/* Jurisdiction + year selectors */}
      <div className="row gap-3 mb-5" style={{ flexWrap: "wrap" }}>
        <div className="seg">
          {["UK", "US", "DE"].map(j => (
            <button key={j} className={jurisdiction === j ? "on" : ""}
                    onClick={() => setJurisdiction(j)}>
              {j === "UK" ? "United Kingdom" : j === "US" ? "United States" : "Germany"}
            </button>
          ))}
        </div>
        <div className="seg">
          {["2024", "2025", "2026"].map(y => (
            <button key={y} className={year === y ? "on" : ""} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="cap muted">Form</span>
          <span className="mono small strong">{formByJurisdiction[jurisdiction]}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-5">
        <StatCard label="Total proceeds"   value={fmtUSD(totalProceeds)} sub={`YTD ${year}`} />
        <StatCard label="Cost basis"        value={fmtUSD(totalProceeds - totalGain)} sub="HMRC matching rule" />
        <StatCard label="Realised gain"     value={fmtUSD(totalGain, { signed: true })} sub="Below allowance" accent />
        <StatCard label="Tax owed · est"    value={fmtUSD(totalGain * 0.10)} sub="At 10% basic rate" />
      </div>

      {/* Allowance bar */}
      <div className="card mb-5">
        <div className="between-bl mb-3">
          <div>
            <div className="card-title">{year}/{(parseInt(year)+1).toString().slice(-2)} CGT allowance · UK</div>
            <div className="muted small mt-2">Annual allowance · £3,000 ($3,820 equiv.)</div>
          </div>
          <div className="num strong" style={{ fontSize: 18 }}>{fmtUSD(totalGain)} / $3,820</div>
        </div>
        <div className="allow-bar">
          <div className="allow-fill" style={{ width: `${Math.min(100, totalGain / 3820 * 100)}%` }} />
        </div>
        <div className="between mt-2 cap muted">
          <span>$0</span>
          <span>$3,820 · annual allowance</span>
        </div>
      </div>

      {/* Lots table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
          <div className="card-title">Realised events · {TAX_LOTS.length}</div>
          <div className="muted small">Sorted by date · newest first</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>Event</th>
              <th className="ar">Proceeds</th>
              <th className="ar">Cost basis</th>
              <th className="ar">Gain</th>
              <th className="ar" style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {TAX_LOTS.map(l => (
              <tr key={l.id}>
                <td className="mono small">{l.date}</td>
                <td className="strong mono">{l.asset}</td>
                <td>{l.event}</td>
                <td className="ar num strong">{window.fmtUSD(l.proceeds)}</td>
                <td className="ar num">{window.fmtUSD(l.proceeds - l.gain)}</td>
                <td className={"ar num strong " + (l.gain > 0 ? "pos" : l.gain < 0 ? "neg" : "")}>
                  {window.fmtUSD(l.gain, { signed: true })}
                </td>
                <td className="ar">
                  <button className="icon-btn" style={{ width: 26, height: 26 }} title="Inspect">
                    <window.Icon name="info" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cap muted mt-4" style={{ lineHeight: 1.6 }}>
        Atrium is not a tax advisor. Export is a calculation aid intended for review by a qualified
        accountant. Signed Merkle root proves the export was produced from the same dataset that
        Lantern attested for the relevant block.
      </div>

      <style>{`
        .allow-bar {
          height: 8px; border-radius: 4px; background: var(--bg-sunk);
          overflow: hidden;
        }
        .allow-fill {
          height: 100%; background: var(--ink);
          border-radius: 4px;
          transition: width 600ms ease;
        }
      `}</style>
    </div>
  );
};

window.Tax = Tax;
