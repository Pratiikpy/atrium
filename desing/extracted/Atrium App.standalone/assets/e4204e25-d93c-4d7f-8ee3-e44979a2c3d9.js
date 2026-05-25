// Agents view — Sigil mandates + Rostrum marketplace

const Agents = () => {
  const { AGENTS, MANDATES, SESSION_KEYS, fmtUSD, fmtPct, Icon, Tag, Avatar,
          Spark, synthSpark, StatCard } = window;

  const [tab, setTab] = React.useState("marketplace");
  const [showCreate, setShowCreate] = React.useState(false);
  const [selected, setSelected] = React.useState(null);

  const activeMandates = MANDATES.filter(m => m.status === "active");
  const totalCap = activeMandates.reduce((s, m) => s + m.cap, 0);
  const totalUsed = activeMandates.reduce((s, m) => s + m.used, 0);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Agents · Sigil & Rostrum</div>
          <h1 className="view-title">Delegate to agents with bounded mandates</h1>
          <div className="view-sub">
            Issue an Intent Sigil, Postern produces a session key, the agent transacts within scope.
          </div>
        </div>
        <div className="view-actions">
          <button className="btn large" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} /> New mandate
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-5">
        <StatCard label="Active mandates" value={activeMandates.length.toString()}
                  sub={`${SESSION_KEYS.length} session keys`} />
        <StatCard label="Total capacity"  value={fmtUSD(totalCap)}
                  sub={fmtUSD(totalUsed) + " used (" + ((totalUsed/totalCap)*100).toFixed(0) + "%)"} />
        <StatCard label="Agents copied"    value="3" sub="Across HL · Pendle · Aave" />
        <StatCard label="Fees paid · 30d"  value="$1,284" sub="To agent operators" />
      </div>

      {/* Tabs */}
      <div className="seg mb-5">
        <button className={tab === "marketplace" ? "on" : ""} onClick={() => setTab("marketplace")}>Marketplace</button>
        <button className={tab === "mandates"    ? "on" : ""} onClick={() => setTab("mandates")}>My mandates</button>
        <button className={tab === "session"     ? "on" : ""} onClick={() => setTab("session")}>Session keys</button>
        <button className={tab === "actions"     ? "on" : ""} onClick={() => setTab("actions")}>Action log</button>
      </div>

      {tab === "marketplace" && <Marketplace setSelected={setSelected} setShowCreate={setShowCreate} />}
      {tab === "mandates"    && <MyMandates />}
      {tab === "session"     && <SessionKeysList />}
      {tab === "actions"     && <ActionLog />}

      {showCreate && (
        <CreateMandate
          onClose={() => { setShowCreate(false); setSelected(null); }}
          preselectedAgent={selected}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

const Marketplace = ({ setSelected, setShowCreate }) => {
  const { AGENTS, fmtUSD, fmtPct, Icon, Tag, Avatar, Spark, synthSpark } = window;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Rostrum · top agents · 7d</div>
          <div className="muted small mt-2">{AGENTS.length} agents · sorted by 7-day P&L</div>
        </div>
        <div className="seg">
          <button className="on">P&amp;L</button>
          <button>Sharpe</button>
          <button>AUM</button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Agent</th>
            <th>Strategy</th>
            <th>30d</th>
            <th className="ar">7d P&L</th>
            <th className="ar">Sharpe</th>
            <th className="ar">AUM</th>
            <th className="ar">Copiers</th>
            <th className="ar" style={{ width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {AGENTS.map((a, i) => {
            const trend = a.pnl7d / 10;
            const data = synthSpark(i + 3, 24, trend);
            return (
              <tr key={a.id}>
                <td className="muted mono">{(i+1).toString().padStart(2, "0")}</td>
                <td className="strong">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar seed={a.handle} size={26} />
                    <div>
                      <div className="mono">{a.handle}</div>
                      <div className="cap muted" style={{ fontSize: 9.5, marginTop: 2 }}>
                        {a.status === "running" ? "● running" : "○ paused"}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{a.strategy}</td>
                <td><Spark data={data} pos={a.pnl7d > 0} w={70} h={24} /></td>
                <td className={"ar num strong " + (a.pnl7d > 0 ? "pos" : "neg")}>
                  {fmtPct(a.pnl7d)}
                </td>
                <td className="ar num">{a.sharpe.toFixed(2)}</td>
                <td className="ar num">{fmtUSD(a.aum, { compact: true })}</td>
                <td className="ar num">{a.copiers}</td>
                <td className="ar">
                  <button className="btn tiny ghost" onClick={() => { setSelected(a); setShowCreate(true); }}>
                    Delegate
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* My mandates                                                         */
/* ------------------------------------------------------------------ */

const MyMandates = () => {
  const { MANDATES, fmtUSD, Icon, Tag, Avatar } = window;
  return (
    <div className="grid-3">
      {MANDATES.map(m => {
        const pct = (m.used / m.cap) * 100;
        const toneOf = (s) => s === "active" ? "green" : s === "expired" ? "amber" : "red";
        return (
          <div key={m.id} className="card" style={{ padding: 20 }}>
            <div className="between-bl mb-3">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar seed={m.agent} size={28} />
                <div>
                  <div className="strong mono">{m.agent}</div>
                  <div className="muted cap" style={{ fontSize: 9.5, marginTop: 2 }}>{m.created}</div>
                </div>
              </div>
              <Tag tone={toneOf(m.status)}>{m.status}</Tag>
            </div>

            <div className="cap mb-2">Capacity used</div>
            <div className="util-bar">
              <div className="util-fill" style={{ width: `${pct}%`, background: m.status === "active" ? "var(--ink)" : "var(--muted)" }} />
            </div>
            <div className="between mt-2 small">
              <span className="mono">{fmtUSD(m.used, { compact: true })} / {fmtUSD(m.cap, { compact: true })}</span>
              <span className="mono muted">{pct.toFixed(0)}%</span>
            </div>

            <div className="card-divider" />

            <div className="kv-mini">
              <div><span>Venues</span><span>{m.venues.join(" · ")}</span></div>
              <div><span>TTL</span><span>{m.ttlDays > 0 ? `${m.ttlDays}d remaining` : "—"}</span></div>
              <div><span>Actions emitted</span><span className="mono">{m.txCount}</span></div>
            </div>

            {m.status === "active" && (
              <div className="row gap-2 mt-4">
                <button className="btn tiny ghost" style={{ flex: 1, justifyContent: "center" }}>Top up</button>
                <button className="btn tiny ghost" style={{ flex: 1, justifyContent: "center" }}>Edit</button>
                <button className="btn tiny ghost" style={{ flex: 1, justifyContent: "center", color: "var(--neg)", borderColor: "color-mix(in oklch, var(--neg) 30%, transparent)" }}>Revoke</button>
              </div>
            )}
          </div>
        );
      })}
      <style>{`
        .util-bar {
          height: 6px; border-radius: 3px; background: var(--bg-sunk);
          position: relative; overflow: hidden;
        }
        .util-fill { height: 100%; border-radius: 3px; transition: width 600ms ease; }
        .kv-mini {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 12.5px;
        }
        .kv-mini > div { display: flex; justify-content: space-between; color: var(--ink-soft); }
        .kv-mini > div > span:last-child { color: var(--ink); font-family: var(--mono); font-size: 11.5px; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Session keys list                                                   */
/* ------------------------------------------------------------------ */

const SessionKeysList = () => {
  const { SESSION_KEYS, Icon } = window;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Fingerprint</th>
            <th>Created</th>
            <th>TTL remaining</th>
            <th>Scope</th>
            <th className="ar" style={{ width: 110 }}></th>
          </tr>
        </thead>
        <tbody>
          {SESSION_KEYS.map(k => (
            <tr key={k.id}>
              <td className="strong mono">{k.agent}</td>
              <td className="mono">{k.fp}</td>
              <td className="mono small">{k.created}</td>
              <td className="mono">{k.ttl}</td>
              <td className="small">{k.scope}</td>
              <td className="ar"><button className="btn tiny ghost" style={{ color: "var(--neg)" }}>Revoke</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Action log                                                          */
/* ------------------------------------------------------------------ */

const ActionLog = () => {
  const { Icon } = window;
  const actions = [
    { ts: "16:14:08", agent: "delphi.eth",  intent: "intent.sigil#0a18", action: "portico.hyperliquid.openLong(rTSLA, 4×)",      ok: true,  cap: "$1,820 of $50,000" },
    { ts: "16:09:42", agent: "delphi.eth",  intent: "intent.sigil#0a18", action: "portico.hyperliquid.adjustMargin(+$5,000)",     ok: true,  cap: "$5,000" },
    { ts: "16:01:17", agent: "helios.eth",  intent: "intent.sigil#0c91", action: "portico.aave.supply(USDC, 12,000)",             ok: true,  cap: "$12,000" },
    { ts: "15:58:09", agent: "helios.eth",  intent: "intent.sigil#0c91", action: "portico.hyperliquid.openShort(rTSLA, 2×)",       ok: true,  cap: "$8,420" },
    { ts: "15:42:18", agent: "pareto.eth",  intent: "intent.sigil#0b22", action: "portico.pendle.redeemPT(stETH-Mar27)",          ok: true,  cap: "$3,200" },
    { ts: "15:21:04", agent: "kepler.eth",  intent: "intent.sigil#0a4f", action: "vigil.stopOut · maxLoss breached",              ok: false, cap: "−$4,820 realised" }
  ];
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Agent</th>
            <th>Action</th>
            <th>Intent</th>
            <th className="ar">Value</th>
            <th className="ar" style={{ width: 80 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={i}>
              <td className="mono small">{a.ts}</td>
              <td className="strong mono">{a.agent}</td>
              <td className="mono small">{a.action}</td>
              <td className="mono small muted">{a.intent}</td>
              <td className="ar mono">{a.cap}</td>
              <td className="ar">
                {a.ok
                  ? <span className="tag green"><Icon name="check" size={11} /> ok</span>
                  : <span className="tag red"><Icon name="x" size={11} /> stop-out</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Create mandate (modal)                                              */
/* ------------------------------------------------------------------ */

const CreateMandate = ({ onClose, preselectedAgent }) => {
  const { AGENTS, VENUES, fmtUSD, Icon } = window;
  const [agent, setAgent]     = React.useState(preselectedAgent?.handle || "delphi.eth");
  const [cap, setCap]         = React.useState(50000);
  const [days, setDays]       = React.useState(7);
  const [venues, setVenues]   = React.useState(["hl3", "hl4"]);
  const [step, setStep]       = React.useState(1); // 1: configure, 2: review, 3: signing, 4: done

  React.useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => setStep(4), 2200);
      return () => clearTimeout(t);
    }
  }, [step]);

  const toggleVenue = (id) => {
    setVenues(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="card-title">New Sigil mandate</div>
            <div className="muted small mt-2">
              {step === 1 ? "Step 1 of 3 · Configure" :
               step === 2 ? "Step 2 of 3 · Review" :
               step === 3 ? "Step 3 of 3 · Sign" : "Mandate active"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        {step === 1 && (
          <div className="modal-body">
            <div className="field">
              <label>Agent</label>
              <select className="select" value={agent} onChange={(e) => setAgent(e.target.value)}>
                {AGENTS.map(a => <option key={a.id}>{a.handle}</option>)}
              </select>
            </div>

            <div className="field mt-4">
              <label>Notional cap · USD</label>
              <input className="input num-input" value={cap}
                     onChange={(e) => setCap(parseFloat(e.target.value) || 0)} />
            </div>

            <div className="field mt-4">
              <div className="between-bl mb-2">
                <label>Time-to-live</label>
                <span className="num strong" style={{ fontSize: 13 }}>{days} days</span>
              </div>
              <input type="range" min="1" max="30" value={days}
                     onChange={(e) => setDays(parseInt(e.target.value))} />
              <div className="between cap muted"><span>1 day</span><span>30 days</span></div>
            </div>

            <div className="field mt-4">
              <label>Permitted venues</label>
              <div className="venue-checks">
                {VENUES.map(v => (
                  <label key={v.id} className={"venue-check" + (venues.includes(v.id) ? " on" : "")}>
                    <input type="checkbox" checked={venues.includes(v.id)} onChange={() => toggleVenue(v.id)} />
                    <span className="mono small">{v.short}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={() => setStep(2)}>Continue <Icon name="arrow" size={12} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="modal-body">
            <div className="cap">Intent Sigil — EIP-712 mandate</div>
            <pre className="mono" style={{
              background: "var(--bg-sunk)", padding: 16, borderRadius: 8,
              fontSize: 11.5, lineHeight: 1.7, marginTop: 10, overflow: "auto"
            }}>{`{
  "type": "atrium.sigil.v1",
  "principal":   "${window.shorten(window.ME.address)}",
  "agent":       "${agent}",
  "cap_usd":     ${cap.toLocaleString()},
  "ttl_seconds": ${days * 86400},
  "venues":      [${venues.map(v => "\"" + v + "\"").join(", ")}],
  "actions":     ["open", "close", "adjust"],
  "issued_at":   "2026-05-18T16:14:00Z"
}`}</pre>
            <div className="muted small mt-3">
              Signing this mandate produces a short-lived session key bound to the constraints above.
              The session key cannot exceed any of these bounds. Revoke at any time.
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn" onClick={() => setStep(3)}>
                <Icon name="shield" size={12} /> Sign with passkey
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="modal-body" style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999, margin: "0 auto",
              border: "1.5px dashed var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "spin 2s linear infinite"
            }}>
              <Icon name="shield" size={28} />
            </div>
            <div className="card-title mt-4">Waiting for passkey</div>
            <div className="muted small mt-2">Touch your authenticator to sign the Intent Sigil</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === 4 && (
          <div className="modal-body" style={{ textAlign: "center", padding: "48px 32px" }}>
            <div className="check-circle">
              <Icon name="check" size={28} />
            </div>
            <div className="card-title mt-4">Mandate active</div>
            <div className="muted small mt-2">
              Session key 0x{Math.floor(Math.random() * 1e8).toString(16).padStart(8, "0")}…b71d
              issued for {agent}
            </div>
            <div className="modal-foot" style={{ justifyContent: "center" }}>
              <button className="btn" onClick={onClose}>Done</button>
            </div>
            <style>{`
              .check-circle {
                width: 80px; height: 80px; border-radius: 999px; margin: 0 auto;
                background: color-mix(in oklch, var(--live) 14%, transparent);
                color: var(--live);
                display: flex; align-items: center; justify-content: center;
              }
            `}</style>
          </div>
        )}

        <style>{`
          .modal-backdrop {
            position: fixed; inset: 0; z-index: 100;
            background: color-mix(in oklch, var(--ink) 50%, transparent);
            display: flex; align-items: center; justify-content: center;
            padding: 24px;
            animation: fade 200ms ease;
          }
          @keyframes fade { from { opacity: 0; } }
          .modal {
            background: var(--bg);
            border: 1px solid var(--line);
            border-radius: 16px;
            width: 480px; max-width: 100%;
            box-shadow: 0 32px 80px rgba(0,0,0,0.2);
          }
          .modal-head {
            padding: 22px 22px 14px;
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 1px solid var(--hairline);
          }
          .modal-body { padding: 22px; }
          .modal-foot {
            margin-top: 22px;
            display: flex; justify-content: flex-end; gap: 8px;
          }
          .venue-checks { display: flex; flex-wrap: wrap; gap: 6px; }
          .venue-check {
            padding: 6px 12px;
            border: 1px solid var(--line); border-radius: 999px;
            cursor: pointer; user-select: none;
            color: var(--ink-soft);
            transition: border-color 120ms, background 120ms;
          }
          .venue-check input { display: none; }
          .venue-check.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        `}</style>
      </div>
    </div>
  );
};

window.Agents = Agents;
