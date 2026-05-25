// Transfer view — Aqueduct · Chainlink CCIP

const Transfer = () => {
  const { fmtUSD, Icon, AddressChip } = window;

  const CHAINS = [
    { id: "arb-sepolia", name: "Arbitrum Sepolia", short: "ARB", chainId: 421614 },
    { id: "eth-sepolia", name: "Ethereum Sepolia", short: "ETH", chainId: 11155111 },
    { id: "rh-chain",    name: "Robinhood Chain",  short: "RHC", chainId: 90909090 },
    { id: "polygon",     name: "Polygon (Aqueduct)", short: "POL", chainId: 80002 }
  ];

  const TOKENS = ["USDC", "WETH", "WBTC", "rAAPL", "rTSLA", "PT-stETH", "USTB"];

  const [fromChain, setFromChain] = React.useState("arb-sepolia");
  const [toChain, setToChain]     = React.useState("rh-chain");
  const [token, setToken]         = React.useState("USDC");
  const [amount, setAmount]       = React.useState("50000");
  const [bridging, setBridging]   = React.useState(false);
  const [progress, setProgress]   = React.useState(0); // 0..4

  const start = () => {
    setBridging(true);
    setProgress(0);
    let p = 0;
    const tick = setInterval(() => {
      p++; setProgress(p);
      if (p >= 4) {
        clearInterval(tick);
        setTimeout(() => { setBridging(false); setProgress(0); }, 3000);
      }
    }, 1400);
  };

  const swap = () => {
    setFromChain(toChain); setToChain(fromChain);
  };

  const ESTIMATED_TIME = "8.4s";
  const CCIP_FEE = "$0.00 · testnet";

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Transfer · Aqueduct</div>
          <h1 className="view-title">Move collateral between chains</h1>
          <div className="view-sub">
            Aqueduct routes through Chainlink CCIP. Posted collateral becomes Plinth credit on arrival.
          </div>
        </div>
      </div>

      <div className="transfer-grid">
        {/* Left: form */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: "16px 22px 0", marginBottom: 0 }}>
            <div className="card-title">New transfer</div>
            <span className="pill"><span className="dot" /> CCIP testnet</span>
          </div>

          <div style={{ padding: 22 }}>
            <div className="field mb-3">
              <label>Token</label>
              <select className="select" value={token} onChange={(e) => setToken(e.target.value)}>
                {TOKENS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="chain-row">
              <ChainCard label="From" chains={CHAINS} value={fromChain} setValue={setFromChain}
                         balance="1,284,300" token={token} />
              <button className="swap-btn" onClick={swap} title="Swap direction">
                <Icon name="transfer" size={14} />
              </button>
              <ChainCard label="To" chains={CHAINS} value={toChain} setValue={setToChain}
                         balance="318,940" token={token} />
            </div>

            <div className="field mt-4">
              <label>Amount</label>
              <div className="amount-input">
                <input className="input num-input" value={amount}
                       onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                <div className="amount-token">{token}</div>
              </div>
              <div className="between mt-2 small muted">
                <span>≈ {fmtUSD(parseFloat(amount || 0))} USD</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="chip" onClick={() => setAmount("25000")}>25%</button>
                  <button className="chip" onClick={() => setAmount("50000")}>50%</button>
                  <button className="chip" onClick={() => setAmount("100000")}>Max</button>
                </div>
              </div>
            </div>

            <div className="card-divider" />

            <div className="kv">
              <div><span>Estimated time</span><span className="num">{ESTIMATED_TIME}</span></div>
              <div><span>CCIP fee</span><span className="num">{CCIP_FEE}</span></div>
              <div><span>Gas · {fromChain}</span><span className="num">$0.00 · Postern sponsored</span></div>
              <div><span>Plinth credit posted</span><span className="num">On arrival</span></div>
            </div>

            <button className="btn large mt-5" style={{ width: "100%", justifyContent: "center" }}
                    onClick={start} disabled={bridging}>
              {bridging ? "Bridging…" : `Transfer ${amount} ${token}`} {!bridging && <Icon name="arrow" size={14} />}
            </button>
            <div className="cap muted mt-3" style={{ textAlign: "center" }}>
              Cross-chain message goes through Chainlink CCIP. Atrium never custodies funds.
            </div>
          </div>
        </div>

        {/* Right: live progress + history */}
        <div className="col gap-4">
          <ProgressCard
            bridging={bridging}
            progress={progress}
            fromChain={CHAINS.find(c => c.id === fromChain)}
            toChain={CHAINS.find(c => c.id === toChain)}
            amount={amount}
            token={token}
          />
          <HistoryCard />
        </div>
      </div>

      <style>{`
        .transfer-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .transfer-grid { grid-template-columns: 1fr; }
        }
        .chain-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 10px;
          align-items: stretch;
        }
        .swap-btn {
          width: 36px;
          align-self: end;
          margin-bottom: 12px;
          height: 36px; border-radius: 999px;
          background: var(--bg-raised);
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-soft); cursor: pointer;
          transition: transform 200ms ease, border-color 120ms ease;
        }
        .swap-btn:hover { transform: rotate(180deg); border-color: var(--ink); color: var(--ink); }
        .amount-input { position: relative; }
        .amount-token {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          font-family: var(--mono); font-size: 13px; color: var(--muted);
        }
        .chip {
          padding: 3px 8px; border-radius: 6px;
          border: 1px solid var(--hairline);
          background: var(--bg-raised);
          font-family: var(--mono); font-size: 10.5px;
          color: var(--muted); cursor: pointer;
        }
        .chip:hover { color: var(--ink); border-color: var(--ink); }
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

const ChainCard = ({ label, chains, value, setValue, balance, token }) => {
  const { Icon } = window;
  const chain = chains.find(c => c.id === value);
  return (
    <div className="chain-card">
      <div className="cap mb-2">{label}</div>
      <div className="chain-select">
        <select className="select chain-select-input" value={value} onChange={(e) => setValue(e.target.value)}>
          {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="between mt-3 small muted">
        <span>Balance</span>
        <span className="num">{balance} {token}</span>
      </div>
      <style>{`
        .chain-card {
          padding: 14px 16px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--bg);
        }
        .chain-select { position: relative; }
        .chain-select-input { padding-right: 32px; cursor: pointer; appearance: none; -webkit-appearance: none; }
      `}</style>
    </div>
  );
};

const ProgressCard = ({ bridging, progress, fromChain, toChain, amount, token }) => {
  const { Icon, fmtUSD } = window;

  const steps = [
    { label: "Signature submitted",     ts: "0.0s" },
    { label: "Source commit · Aqueduct", ts: "1.2s" },
    { label: "CCIP message in transit",  ts: "3.4s" },
    { label: "Destination finalised",    ts: "8.4s" }
  ];

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
        <div className="card-title">
          {bridging ? "Transfer in progress" : "Last transfer"}
        </div>
        <span className={"pill"} style={{ borderColor: bridging ? "var(--live)" : "var(--line)" }}>
          <span className="dot" /> {bridging ? "bridging" : "settled"}
        </span>
      </div>

      <div style={{ padding: "8px 22px 22px" }}>
        {/* From → To chip */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center", gap: 12,
          padding: 14, border: "1px solid var(--hairline)",
          borderRadius: 10, background: "var(--bg-sunk)"
        }}>
          <div>
            <div className="cap">From</div>
            <div className="strong mono small mt-2">{fromChain.short}</div>
            <div className="muted small">{fromChain.name}</div>
          </div>
          <CCIPArrow active={progress} />
          <div className="ar">
            <div className="cap">To</div>
            <div className="strong mono small mt-2">{toChain.short}</div>
            <div className="muted small">{toChain.name}</div>
          </div>
        </div>

        <div className="num mt-4" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
          {parseFloat(amount).toLocaleString()} <span className="muted" style={{ fontSize: 14 }}>{token}</span>
        </div>

        <div className="mt-4">
          {steps.map((s, i) => {
            const active = bridging ? i <= progress : true;
            return (
              <div key={i} className="step-row" style={{ opacity: active ? 1 : 0.32 }}>
                <span className="step-mark" style={{ background: active ? "var(--ink)" : "transparent",
                          borderColor: active ? "var(--ink)" : "var(--line)" }}>
                  {i < progress || (!bridging) ? <Icon name="check" size={10} /> : null}
                </span>
                <div className="col" style={{ flex: 1, gap: 2 }}>
                  <div className="small strong">{s.label}</div>
                  <div className="mono cap muted" style={{ fontSize: 9.5 }}>
                    {bridging ? (i === progress ? "in progress" : i < progress ? "complete" : "queued") : "complete"}
                  </div>
                </div>
                <div className="mono cap" style={{ color: "var(--muted)" }}>{s.ts}</div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .step-row {
          display: grid; grid-template-columns: 22px 1fr auto;
          gap: 10px; align-items: center;
          padding: 9px 0;
          transition: opacity 300ms ease;
        }
        .step-mark {
          width: 18px; height: 18px; border-radius: 999px;
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          color: var(--bg);
          transition: background 200ms, border-color 200ms;
        }
      `}</style>
    </div>
  );
};

const CCIPArrow = ({ active }) => {
  return (
    <svg width="120" height="28" viewBox="0 0 120 28">
      <line x1="6" y1="14" x2="114" y2="14" stroke="var(--line)" strokeWidth="1" />
      <line x1="6" y1="14" x2={Math.min(114, 6 + (active + 1) * 27)} y2="14"
            stroke="var(--ink)" strokeWidth="1.5"
            style={{ transition: "all 600ms ease" }} />
      <polyline points="106,9 116,14 106,19" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx={Math.min(112, 6 + (active + 1) * 27)} cy="14" r="3" fill="var(--ink)"
              style={{ transition: "all 600ms ease" }} />
    </svg>
  );
};

const HistoryCard = () => {
  const { Icon, fmtUSD } = window;
  const history = [
    { ts: "14:58:32",  amt: 200000, tok: "USDC",     from: "arb-sepolia", to: "rh-chain",    duration: "8.4s",  hash: "0x301f…9d22", status: "settled" },
    { ts: "13:21:14",  amt: 50000,  tok: "USDC",     from: "eth-sepolia", to: "arb-sepolia", duration: "12.1s", hash: "0xa1f0…b288", status: "settled" },
    { ts: "11:47:08",  amt: 5,      tok: "WETH",     from: "arb-sepolia", to: "rh-chain",    duration: "9.8s",  hash: "0x744c…1801", status: "settled" },
    { ts: "Yesterday", amt: 1820,   tok: "rAAPL",    from: "rh-chain",    to: "arb-sepolia", duration: "7.2s",  hash: "0xc833…40af", status: "settled" }
  ];
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 0", marginBottom: 0 }}>
        <div className="card-title">Recent transfers</div>
        <a className="ulink small" href="#">View all</a>
      </div>
      <div style={{ padding: "8px 22px 14px" }}>
        {history.map((h, i) => (
          <div key={i} className="history-row">
            <Icon name="transfer" size={14} />
            <div className="col" style={{ minWidth: 0, gap: 2 }}>
              <div className="small strong">{parseFloat(h.amt).toLocaleString()} {h.tok}</div>
              <div className="mono muted" style={{ fontSize: 10.5 }}>
                {h.from} → {h.to} · {h.duration}
              </div>
            </div>
            <div className="ar">
              <div className="mono small muted">{h.ts}</div>
              <div className="mono cap" style={{ fontSize: 9.5, color: "var(--live)" }}>{h.status}</div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .history-row {
          display: grid; grid-template-columns: 20px 1fr auto;
          gap: 12px; align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .history-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
};

window.Transfer = Transfer;
