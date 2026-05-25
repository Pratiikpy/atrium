// Settings view — Postern · wallet, session keys, recovery, network

const Settings = () => {
  const { SESSION_KEYS, RECOVERY_GUARDIANS, ME, Icon, Tag, AddressChip, shorten } = window;
  const [section, setSection] = React.useState("wallet");

  const SECTIONS = [
    { id: "wallet",   label: "Wallet",     icon: "settings" },
    { id: "session",  label: "Session keys", icon: "shield" },
    { id: "recovery", label: "Recovery",   icon: "shield" },
    { id: "network",  label: "Network",    icon: "transfer" },
    { id: "notify",   label: "Notifications", icon: "bell" },
    { id: "account",  label: "Account",    icon: "agents" }
  ];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="cap" style={{ marginBottom: 8 }}>Settings · Postern</div>
          <h1 className="view-title">Wallet & account</h1>
          <div className="view-sub">Postern is the ERC-4337 + EIP-7702 layer that holds your passkey, session keys, and gas sponsorship credit.</div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Sidebar */}
        <div className="settings-nav">
          {SECTIONS.map(s => (
            <button key={s.id}
                    className={"settings-nav-link" + (section === s.id ? " active" : "")}
                    onClick={() => setSection(s.id)}>
              <Icon name={s.icon} size={14} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="col gap-5">
          {section === "wallet"   && <WalletSection />}
          {section === "session"  && <SessionSection />}
          {section === "recovery" && <RecoverySection />}
          {section === "network"  && <NetworkSection />}
          {section === "notify"   && <NotifySection />}
          {section === "account"  && <AccountSection />}
        </div>
      </div>

      <style>{`
        .settings-grid {
          display: grid; grid-template-columns: 220px 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 880px) { .settings-grid { grid-template-columns: 1fr; } }
        .settings-nav {
          display: flex; flex-direction: column; gap: 2px;
          position: sticky; top: 80px;
        }
        .settings-nav-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          border: none; background: transparent; border-radius: 8px;
          color: var(--ink-soft); cursor: pointer;
          font-family: var(--sans); font-size: 13.5px;
          text-align: left;
          transition: background 120ms ease, color 120ms ease;
        }
        .settings-nav-link:hover { background: var(--bg-sunk); color: var(--ink); }
        .settings-nav-link.active { background: var(--ink); color: var(--bg); }
      `}</style>
    </div>
  );
};

const WalletSection = () => {
  const { ME, shorten, Icon, AddressChip, Tag } = window;
  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Smart wallet</div>
          <span className="tag green"><Icon name="check" size={11} /> ERC-4337 · 7702 ready</span>
        </div>
        <div className="kv-grid">
          <div><span>Address</span><AddressChip address={ME.address} /></div>
          <div><span>ENS</span><span className="mono small strong">{ME.ens}</span></div>
          <div><span>Authenticator</span><span className="small strong">{ME.passkey}</span></div>
          <div><span>Bundler</span><span className="mono small">Pimlico · testnet</span></div>
          <div><span>Paymaster</span><span className="mono small">Pimlico verifying paymaster</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Gas sponsorship</div>
            <div className="muted small mt-2">Atrium pays gas for your first ten UserOperations</div>
          </div>
          <span className="tag green">active</span>
        </div>
        <div className="between-bl mb-3 mt-3">
          <span className="cap">UserOps sponsored</span>
          <span className="num strong">4 / 10</span>
        </div>
        <div className="allow-bar"><div className="allow-fill" style={{ width: "40%" }} /></div>
        <div className="cap muted mt-3">Resets monthly. Subsidised from Codex revenue after launch.</div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Connected sites</div>
            <div className="muted small mt-2">Sites that have your wallet authorisation</div>
          </div>
          <button className="btn tiny ghost">Revoke all</button>
        </div>
        <div className="conn-list">
          {[
            { site: "atrium.fi · app",     ts: "now" },
            { site: "lantern.atrium.fi",    ts: "38 min ago" },
            { site: "rostrum.atrium.fi",   ts: "1 hour ago" }
          ].map(c => (
            <div key={c.site} className="conn-row">
              <div className="strong mono small">{c.site}</div>
              <div className="mono cap muted" style={{ fontSize: 9.5 }}>{c.ts}</div>
              <button className="btn tiny ghost">Disconnect</button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .allow-bar { height: 6px; border-radius: 3px; background: var(--bg-sunk); overflow: hidden; }
        .allow-fill { height: 100%; background: var(--ink); border-radius: 3px; transition: width 600ms ease; }
        .kv-grid {
          display: flex; flex-direction: column; gap: 12px;
          margin-top: 6px;
        }
        .kv-grid > div {
          display: grid; grid-template-columns: 160px 1fr;
          gap: 12px; align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .kv-grid > div:last-child { border-bottom: none; }
        .kv-grid > div > span:first-child {
          font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--muted);
        }
        .conn-list { margin-top: 4px; }
        .conn-row {
          display: grid; grid-template-columns: 1fr auto auto;
          gap: 16px; align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .conn-row:last-child { border-bottom: none; }
      `}</style>
    </>
  );
};

const SessionSection = () => {
  const { SESSION_KEYS, Icon } = window;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Session keys · {SESSION_KEYS.length} active</div>
          <div className="muted small mt-2">ERC-7715. One per Sigil mandate. Revocable in a single transaction.</div>
        </div>
        <a className="btn tiny ghost" href="#agents">Manage in Agents</a>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Fingerprint</th>
            <th>Scope</th>
            <th>Created</th>
            <th>Expires</th>
            <th className="ar" style={{ width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {SESSION_KEYS.map(k => (
            <tr key={k.id}>
              <td className="strong mono">{k.agent}</td>
              <td className="mono small">{k.fp}</td>
              <td className="small">{k.scope}</td>
              <td className="mono small">{k.created}</td>
              <td className="mono">{k.ttl}</td>
              <td className="ar">
                <button className="btn tiny ghost" style={{ color: "var(--neg)" }}>Revoke</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RecoverySection = () => {
  const { RECOVERY_GUARDIANS, Icon } = window;
  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Social recovery</div>
            <div className="muted small mt-2">Recover your smart wallet through 2-of-3 guardian approval if you lose your passkey.</div>
          </div>
          <span className="tag green"><Icon name="check" size={11} /> 3 guardians</span>
        </div>

        <div className="gd-list">
          {RECOVERY_GUARDIANS.map(g => (
            <div key={g.id} className="gd-row">
              <div className="gd-avatar"><Icon name="shield" size={14} /></div>
              <div className="col" style={{ gap: 2 }}>
                <div className="small strong">{g.label}</div>
                <div className="mono cap muted" style={{ fontSize: 9.5 }}>{g.fp} · added {g.added}</div>
              </div>
              <span className="tag green">{g.status}</span>
              <button className="btn tiny ghost">Remove</button>
            </div>
          ))}
        </div>

        <button className="btn ghost mt-4"><Icon name="plus" size={12} /> Add guardian</button>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Backup phrase</div>
            <div className="muted small mt-2">Off-chain seed for cold recovery. Stored encrypted, key derived from passkey.</div>
          </div>
          <button className="btn tiny ghost">View</button>
        </div>
      </div>

      <style>{`
        .gd-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .gd-row {
          display: grid; grid-template-columns: 32px 1fr auto auto;
          gap: 12px; align-items: center;
          padding: 12px 14px;
          background: var(--bg-sunk);
          border-radius: 10px;
        }
        .gd-avatar {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--bg-raised); border: 1px solid var(--hairline);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-soft);
        }
      `}</style>
    </>
  );
};

const NetworkSection = () => {
  const { Icon, Tag } = window;
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-head" style={{ padding: "16px 22px 12px", marginBottom: 0 }}>
        <div>
          <div className="card-title">Networks</div>
          <div className="muted small mt-2">Atrium operates across these testnet chains.</div>
        </div>
        <span className="pill"><span className="dot" /> all healthy</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Chain</th>
            <th>Chain ID</th>
            <th>Role</th>
            <th>RPC latency</th>
            <th className="ar">Status</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "Robinhood Chain testnet", id: 90909090, role: "Primary deploy · margin engine", latency: 38 },
            { name: "Arbitrum Sepolia",        id: 421614,   role: "Stylus deploy · venues",         latency: 62 },
            { name: "Ethereum Sepolia",        id: 11155111, role: "CCIP anchor",                    latency: 184 },
            { name: "Polygon Amoy",            id: 80002,    role: "Polymarket via Aqueduct",        latency: 92 }
          ].map(n => (
            <tr key={n.id}>
              <td className="strong">{n.name}</td>
              <td className="mono">{n.id}</td>
              <td className="small">{n.role}</td>
              <td className="mono">{n.latency}ms</td>
              <td className="ar"><span className="tag green"><Icon name="check" size={11} /> healthy</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NotifySection = () => {
  const { Icon } = window;
  const items = [
    { key: "liq", title: "Liquidation warnings",       desc: "When Plinth utilisation crosses 60% or 85%", on: true },
    { key: "act", title: "Agent action confirmations", desc: "Every Action Sigil emitted by your agents",   on: true },
    { key: "att", title: "Attestation delta",          desc: "Lantern delta > 0.1 bps",                     on: false },
    { key: "fund", title: "Funding-rate alerts",       desc: "When funding crosses your threshold",         on: true },
    { key: "mand", title: "Mandate expiry · 24h",      desc: "Reminder before any session key expires",     on: true }
  ];
  const [state, setState] = React.useState(items.reduce((a, x) => ({ ...a, [x.key]: x.on }), {}));
  return (
    <div className="card">
      <div className="card-title">Notifications</div>
      <div className="muted small mt-2 mb-4">Email, push, and webhook destinations are configured separately.</div>
      <div className="ntf-list">
        {items.map(it => (
          <label key={it.key} className="ntf-row">
            <div>
              <div className="strong small">{it.title}</div>
              <div className="muted small mt-2">{it.desc}</div>
            </div>
            <div className={"toggle" + (state[it.key] ? " on" : "")}
                 onClick={() => setState(s => ({ ...s, [it.key]: !s[it.key] }))}>
              <span className="thumb" />
            </div>
          </label>
        ))}
      </div>
      <style>{`
        .ntf-list { display: flex; flex-direction: column; }
        .ntf-row {
          display: grid; grid-template-columns: 1fr 44px;
          gap: 16px; align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--hairline);
          cursor: pointer;
        }
        .ntf-row:last-child { border-bottom: none; }
        .toggle {
          width: 38px; height: 22px; border-radius: 999px;
          background: var(--line);
          position: relative;
          transition: background 180ms ease;
        }
        .toggle .thumb {
          position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px; border-radius: 999px;
          background: var(--bg);
          transition: transform 220ms cubic-bezier(.4,.2,.2,1);
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .toggle.on { background: var(--ink); }
        .toggle.on .thumb { transform: translateX(16px); }
      `}</style>
    </div>
  );
};

const AccountSection = () => {
  const { ME, Icon, AddressChip } = window;
  return (
    <>
      <div className="card">
        <div className="card-title">Tier · Edict jurisdiction registry</div>
        <div className="muted small mt-2 mb-4">Sumsub sandbox · KYC tier determines venue access.</div>
        <div className="tier-grid">
          {[
            { tier: 1, label: "Sandbox",     desc: "Testnet only · no caps",     active: true },
            { tier: 2, label: "Retail",       desc: "≤$100K notional",            active: false },
            { tier: 3, label: "Professional", desc: "≤$5M notional · 5× leverage", active: false },
            { tier: 4, label: "Institutional", desc: "No caps · full agent suite",  active: false }
          ].map(t => (
            <div key={t.tier} className={"tier-card" + (t.active ? " on" : "")}>
              <div className="cap muted">Tier {t.tier}</div>
              <div className="strong mt-2">{t.label}</div>
              <div className="muted small mt-2">{t.desc}</div>
              {t.active && <span className="tag green mt-3" style={{ display: "inline-flex" }}><Icon name="check" size={11} /> active</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Danger zone</div>
        <div className="muted small mt-2 mb-4">Irreversible account actions.</div>
        <button className="btn ghost danger">Export account data</button>
        <button className="btn ghost danger" style={{ marginLeft: 8 }}>Close account</button>
      </div>

      <style>{`
        .tier-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
        }
        @media (max-width: 700px) { .tier-grid { grid-template-columns: 1fr 1fr; } }
        .tier-card {
          padding: 14px 16px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--bg-raised);
        }
        .tier-card.on { border-color: var(--ink); background: var(--bg); }
        .btn.danger {
          color: var(--neg);
          border-color: color-mix(in oklch, var(--neg) 30%, transparent);
        }
        .btn.danger:hover { border-color: var(--neg); }
      `}</style>
    </>
  );
};

window.Settings = Settings;
