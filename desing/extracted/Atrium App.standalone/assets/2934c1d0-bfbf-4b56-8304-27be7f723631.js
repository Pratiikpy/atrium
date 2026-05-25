// Onboarding flow — Postern passkey + faucet drop

const Onboarding = () => {
  const { Wordmark, Icon, Pill, fmtUSD } = window;
  const [step, setStep] = React.useState(0);
  const [signing, setSigning] = React.useState(false);

  const steps = [
    { label: "Welcome" },
    { label: "Authenticator" },
    { label: "Faucet" },
    { label: "Margin posted" },
    { label: "Done" }
  ];

  const next = () => setStep(s => s + 1);

  return (
    <div className="onb">
      <div className="onb-top">
        <Wordmark size={20} />
        <Pill kind="testnet">testnet · arb-sepolia</Pill>
      </div>

      <div className="onb-stage">
        <div className="onb-rail">
          {steps.map((s, i) => (
            <div key={i} className={"onb-rail-step" + (i === step ? " current" : i < step ? " done" : "")}>
              <span className="rail-mark">{i < step ? <Icon name="check" size={11} /> : (i + 1)}</span>
              <span className="rail-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="onb-card">
          {step === 0 && <Welcome next={next} />}
          {step === 1 && <Passkey   next={next} signing={signing} setSigning={setSigning} />}
          {step === 2 && <Faucet    next={next} />}
          {step === 3 && <MarginPosted next={next} />}
          {step === 4 && <DoneStep  />}
        </div>
      </div>

      <style>{`
        .onb {
          min-height: 100vh;
          display: flex; flex-direction: column;
          background:
            radial-gradient(ellipse at 60% 0%, color-mix(in oklch, var(--accent) 6%, transparent), transparent 50%),
            var(--bg);
        }
        .onb-top {
          padding: 22px 32px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .onb-stage {
          flex: 1;
          display: grid;
          grid-template-columns: 220px 1fr;
          max-width: 980px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 32px 64px;
          gap: 48px;
          align-items: start;
        }
        @media (max-width: 800px) { .onb-stage { grid-template-columns: 1fr; gap: 24px; } }

        .onb-rail {
          display: flex; flex-direction: column; gap: 4px;
          position: sticky; top: 24px;
        }
        .onb-rail-step {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px;
          font-size: 13px;
          color: var(--muted);
          border-radius: 8px;
        }
        .rail-mark {
          width: 22px; height: 22px; border-radius: 999px;
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--mono); font-size: 11px;
          color: var(--muted);
          background: var(--bg);
        }
        .onb-rail-step.current { color: var(--ink); }
        .onb-rail-step.current .rail-mark { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .onb-rail-step.done .rail-mark { background: var(--live); color: var(--bg); border-color: var(--live); }
        .onb-rail-step.done { color: var(--ink-soft); }

        .onb-card {
          background: var(--bg-raised);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 40px 44px 36px;
          min-height: 380px;
          box-shadow: 0 1px 1px rgba(0,0,0,0.02), 0 10px 30px rgba(0,0,0,0.04);
        }
        @media (max-width: 800px) { .onb-card { padding: 28px 24px; } }

        .onb-title {
          font-family: var(--sans);
          font-weight: 500;
          font-size: 32px;
          line-height: 1.1;
          letter-spacing: -0.022em;
          color: var(--ink);
          margin: 0;
        }
        .onb-sub {
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink-soft);
          margin: 12px 0 0;
          max-width: 38em;
        }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 1 — Welcome                                                          */
/* ------------------------------------------------------------------ */
const Welcome = ({ next }) => {
  const { Icon } = window;
  return (
    <>
      <div className="cap muted mb-3">01 · Welcome</div>
      <h1 className="onb-title">Step inside the atrium.</h1>
      <p className="onb-sub">
        Atrium is unified margin prime brokerage for the EVM. This is the open testnet.
        You'll need ninety seconds to set up an authenticator, claim a faucet drop, and
        post your first cross-margin position.
      </p>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
        <Feature icon="shield"   title="No seed phrase"
                 desc="Postern uses a passkey on your device. Lost device? Recover through guardians." />
        <Feature icon="trade"    title="Gas is sponsored"
                 desc="The first ten UserOperations are on us. You'll never see a gas dialog this session." />
        <Feature icon="reserves" title="Funds are testnet only"
                 desc="Nothing on this network has economic value. Test markets, agents, and strategies safely." />
      </div>

      <div style={{ marginTop: 32, display: "flex", gap: 10 }}>
        <button className="btn large" onClick={next}>
          Set up authenticator <Icon name="arrow" size={14} />
        </button>
        <a className="btn ghost large" href="#portfolio">Skip to app →</a>
      </div>
    </>
  );
};

const Feature = ({ icon, title, desc }) => {
  const { Icon } = window;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "start" }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: "var(--bg-sunk)",
        border: "1px solid var(--hairline)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--ink-soft)"
      }}>
        <Icon name={icon} size={14} />
      </div>
      <div>
        <div className="strong small">{title}</div>
        <div className="muted small mt-2">{desc}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2 — Passkey                                                          */
/* ------------------------------------------------------------------ */
const Passkey = ({ next, signing, setSigning }) => {
  const { Icon } = window;
  const start = () => {
    setSigning(true);
    setTimeout(() => { setSigning(false); next(); }, 2400);
  };
  return (
    <>
      <div className="cap muted mb-3">02 · Authenticator</div>
      <h1 className="onb-title">Create your passkey.</h1>
      <p className="onb-sub">
        Atrium uses a WebAuthn passkey instead of a seed phrase. Your browser or
        hardware authenticator will produce a key pair scoped to atrium.fi.
      </p>

      <div style={{
        marginTop: 32,
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        padding: 24,
        background: "var(--bg)",
        textAlign: "center"
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 999, margin: "0 auto",
          border: `1.5px ${signing ? "dashed" : "solid"} var(--ink)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink)",
          animation: signing ? "spin 2s linear infinite" : "none"
        }}>
          <Icon name="shield" size={28} />
        </div>
        <div className="strong mt-4">{signing ? "Waiting for authenticator…" : "Touch to authenticate"}</div>
        <div className="muted small mt-2">
          {signing ? "Approve on your device" : "ATRIUM · Yubikey 5C · Touch ID · Windows Hello"}
        </div>
        <button className="btn large mt-5" onClick={start} disabled={signing}
                style={{ width: "100%", justifyContent: "center" }}>
          {signing ? "Waiting…" : "Authenticate"}
        </button>
      </div>

      <div className="muted small mt-5" style={{ display: "flex", gap: 18, justifyContent: "center" }}>
        <span><Icon name="check" size={11} /> No seed phrase</span>
        <span><Icon name="check" size={11} /> Phishing-resistant</span>
        <span><Icon name="check" size={11} /> Recoverable</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 3 — Faucet                                                           */
/* ------------------------------------------------------------------ */
const Faucet = ({ next }) => {
  const { Icon, fmtUSD } = window;
  const [claiming, setClaiming] = React.useState(false);
  const [claimed, setClaimed]   = React.useState(false);

  const claim = () => {
    setClaiming(true);
    setTimeout(() => { setClaiming(false); setClaimed(true); }, 1600);
  };

  const drops = [
    { token: "USDC",  amount: 10000,  chain: "arb-sepolia" },
    { token: "USDC",  amount:  5000,  chain: "rh-chain" },
    { token: "rAAPL", amount:    25,  chain: "rh-chain" },
    { token: "WETH",  amount:     3,  chain: "arb-sepolia" }
  ];

  return (
    <>
      <div className="cap muted mb-3">03 · Faucet</div>
      <h1 className="onb-title">Claim your testnet drop.</h1>
      <p className="onb-sub">
        Atrium sends each new account a fixed package of test assets so you can
        experience real cross-margin. None of this has economic value.
      </p>

      <div style={{ marginTop: 32 }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Token</th>
              <th>Amount</th>
              <th>Network</th>
              <th className="ar">Status</th>
            </tr>
          </thead>
          <tbody>
            {drops.map((d, i) => (
              <tr key={i}>
                <td className="strong mono">{d.token}</td>
                <td className="num">{d.amount.toLocaleString()}</td>
                <td className="mono small">{d.chain}</td>
                <td className="ar">
                  {claimed
                    ? <span className="tag green"><Icon name="check" size={11} /> received</span>
                    : claiming
                      ? <span className="tag amber">claiming…</span>
                      : <span className="tag">pending</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32, display: "flex", gap: 10 }}>
        {!claimed
          ? <button className="btn large" onClick={claim} disabled={claiming}
                    style={{ flex: 1, justifyContent: "center" }}>
              {claiming ? "Claiming…" : "Claim faucet"}
            </button>
          : <button className="btn large" onClick={next}
                    style={{ flex: 1, justifyContent: "center" }}>
              Continue <Icon name="arrow" size={14} />
            </button>}
      </div>
      <div className="cap muted mt-3" style={{ textAlign: "center" }}>
        Faucet rate-limited to one claim per address per month
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 4 — Margin Posted (Plinth ready)                                     */
/* ------------------------------------------------------------------ */
const MarginPosted = ({ next }) => {
  const { Icon, fmtUSD } = window;
  return (
    <>
      <div className="cap muted mb-3">04 · Plinth</div>
      <h1 className="onb-title">Cross-margin posted.</h1>
      <p className="onb-sub">
        Your faucet drop is now collateral. Plinth has computed your buying power
        across all seven live venues and your portfolio is ready to trade.
      </p>

      <div style={{
        marginTop: 32,
        border: "1px solid var(--ink)",
        borderRadius: 12,
        padding: 28,
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div className="cap muted">Buying power · 3.0× portfolio margin</div>
        <div className="num" style={{ fontSize: 48, letterSpacing: "-0.025em", lineHeight: 1, marginTop: 14 }}>
          $46,500
        </div>
        <div className="cap mt-3" style={{ color: "var(--live)" }}>● Plinth · margin ok</div>

        <div className="kv-row mt-5">
          <div>
            <div className="cap muted">Collateral</div>
            <div className="num strong mt-2">$15,500</div>
          </div>
          <div>
            <div className="cap muted">Utilisation</div>
            <div className="num strong mt-2">0.0%</div>
          </div>
          <div>
            <div className="cap muted">Headroom</div>
            <div className="num strong mt-2">$46,500</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
        <button className="btn large" onClick={next} style={{ flex: 1, justifyContent: "center" }}>
          Open portfolio <Icon name="arrow" size={14} />
        </button>
      </div>

      <style>{`
        .kv-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          padding-top: 24px; margin-top: 0;
          border-top: 1px solid var(--hairline);
          gap: 16px;
        }
      `}</style>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 5 — Done                                                             */
/* ------------------------------------------------------------------ */
const DoneStep = () => {
  const { Icon } = window;
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{
        width: 88, height: 88, borderRadius: 999, margin: "0 auto",
        background: "color-mix(in oklch, var(--live) 14%, transparent)",
        color: "var(--live)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <Icon name="check" size={36} />
      </div>
      <h1 className="onb-title mt-5">You're ready.</h1>
      <p className="onb-sub" style={{ margin: "12px auto 0" }}>
        Three things you can do next.
      </p>

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <NextCard href="#portfolio" icon="portfolio" title="See your portfolio" desc="Plinth health, positions, P&L" />
        <NextCard href="#trade"     icon="trade"     title="Place a trade"      desc="Seven venues, one signature" />
        <NextCard href="#agents"    icon="agents"    title="Delegate to an agent" desc="Issue your first Sigil" />
      </div>
    </div>
  );
};

const NextCard = ({ href, icon, title, desc }) => {
  const { Icon } = window;
  return (
    <a href={href} className="next-card">
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: "var(--bg-sunk)", border: "1px solid var(--hairline)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--ink-soft)", marginBottom: 12
      }}>
        <Icon name={icon} size={13} />
      </div>
      <div className="strong small">{title}</div>
      <div className="muted small mt-2">{desc}</div>
      <style>{`
        .next-card {
          padding: 18px;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 10px;
          text-decoration: none; color: var(--ink);
          text-align: left;
          transition: border-color 120ms ease, transform 120ms ease;
        }
        .next-card:hover { border-color: var(--ink); transform: translateY(-2px); }
      `}</style>
    </a>
  );
};

window.Onboarding = Onboarding;
