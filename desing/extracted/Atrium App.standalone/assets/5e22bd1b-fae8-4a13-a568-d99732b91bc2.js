// App shell — sidebar, topbar, hash-based router

const { Icon, Wordmark, Pill, Avatar, AddressChip } = window;

const ROUTES = [
  { id: "portfolio", label: "Portfolio",  group: "trade",   icon: "portfolio", title: "Portfolio",  sub: "Plinth · unified margin" },
  { id: "trade",     label: "Trade",      group: "trade",   icon: "trade",     title: "Trade",      sub: "Portico · venue execution" },
  { id: "transfer",  label: "Transfer",   group: "trade",   icon: "transfer",  title: "Transfer",   sub: "Aqueduct · Chainlink CCIP" },
  { id: "agents",    label: "Agents",     group: "agents",  icon: "agents",    title: "Agents",     sub: "Sigil · Rostrum" },
  { id: "reserves",  label: "Reserves",   group: "trust",   icon: "reserves",  title: "Reserves",   sub: "Lantern · proof-of-reserves" },
  { id: "tax",       label: "Tax",        group: "trust",   icon: "tax",       title: "Tax",        sub: "Tablet · exports" },
  { id: "settings",  label: "Settings",   group: "account", icon: "settings",  title: "Settings",   sub: "Postern · wallet" },
  { id: "onboarding", label: "Onboarding", group: "_hidden", icon: "shield",   title: "Welcome to Atrium", sub: "Postern · passkey + faucet" }
];

const GROUPS = [
  { id: "trade",   label: "Trade" },
  { id: "agents",  label: "Agents" },
  { id: "trust",   label: "Trust" },
  { id: "account", label: "Account" }
];

const VIEWS = {
  portfolio:  () => <window.Portfolio />,
  trade:      () => <window.Trade />,
  transfer:   () => <window.Transfer />,
  agents:     () => <window.Agents />,
  reserves:   () => <window.Reserves />,
  tax:        () => <window.Tax />,
  settings:   () => <window.Settings />,
  onboarding: () => <window.Onboarding />
};

const useRoute = () => {
  const parse = () => {
    const raw = window.location.hash.slice(1) || "portfolio";
    return raw.split("?")[0] || "portfolio";
  };
  const [route, setRoute] = React.useState(parse());
  React.useEffect(() => {
    const onHash = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
};

const Sidebar = ({ route }) => (
  <aside className="side">
    <div className="side-brand">
      <a href="#portfolio" style={{ textDecoration: "none" }}>
        <Wordmark size={20} />
      </a>
      <Pill kind="testnet">testnet</Pill>
    </div>

    <div className="side-search">
      <Icon name="search" size={14} />
      <span>Search · positions, agents</span>
      <span className="kbd">⌘K</span>
    </div>

    {GROUPS.map(g => (
      <div key={g.id} className="side-section">
        <div className="side-section-head">{g.label}</div>
        {ROUTES.filter(r => r.group === g.id).map(r => {
          const active = route === r.id;
          let pill = null;
          if (r.id === "agents")    pill = "3";
          if (r.id === "reserves")  pill = "✓";
          return (
            <a key={r.id} href={"#" + r.id} className={"side-link" + (active ? " active" : "")}>
              <span className="si"><Icon name={r.icon} size={15} /></span>
              <span>{r.label}</span>
              {pill && <span className="pill-mini">{pill}</span>}
            </a>
          );
        })}
      </div>
    ))}

    <div className="side-foot">
      <div className="side-wallet">
        <div className="avatar" />
        <div>
          <div className="ad">{window.shorten(window.ME.address)}</div>
          <div className="net">arb-sepolia · rh-chain</div>
        </div>
        <span className="chev"><Icon name="chev" size={14} /></span>
      </div>
    </div>
  </aside>
);

const TopBar = ({ route }) => {
  const r = ROUTES.find(x => x.id === route) || ROUTES[0];
  return (
    <div className="topbar">
      <div className="crumb">
        <span className="crumb-main">{r.title}</span>
        <span className="crumb-sep">·</span>
        <span className="crumb-sub">{r.sub}</span>
      </div>
      <div className="topbar-right">
        <span className="pill"><span className="dot" /> live · arb-sepolia</span>
        <button className="icon-btn" title="Notifications"><Icon name="bell" size={14} /></button>
        <button className="icon-btn" title="Refresh"><Icon name="refresh" size={14} /></button>
        <a className="btn" href="#trade"><Icon name="plus" size={12} /> New trade</a>
      </div>
    </div>
  );
};

const AppShell = () => {
  const route = useRoute();
  const View = VIEWS[route] || VIEWS.portfolio;
  const isOnboarding = route === "onboarding";

  if (isOnboarding) {
    return <View />;
  }

  return (
    <div className="app">
      <Sidebar route={route} />
      <main className="app-main">
        <TopBar route={route} />
        <View />
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<AppShell />);

Object.assign(window, { ROUTES, GROUPS, useRoute });
