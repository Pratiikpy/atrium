// Shared UI atoms for the Atrium app

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const Wordmark = ({ size = 22 }) => (
  <span className="atrium-mark" style={{ fontSize: size, lineHeight: 1 }}>
    Atrium
  </span>
);

/* Minimal stroke icons (16x16) — used in sidebar */
const Icon = ({ name, size = 16 }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    portfolio: <svg {...common}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 7h12" /><path d="M5.5 10h2 M9 10h1.5" /></svg>,
    trade:     <svg {...common}><path d="M2.5 11.5l3-3 2.5 2.5 5.5-5.5" /><path d="M9.5 5.5h4v4" /></svg>,
    transfer:  <svg {...common}><path d="M2 5h11l-2.4-2.4 M14 11H3l2.4 2.4" /></svg>,
    agents:    <svg {...common}><circle cx="8" cy="6" r="2.4" /><path d="M3 13c0-2.4 2.2-4 5-4s5 1.6 5 4" /></svg>,
    reserves:  <svg {...common}><path d="M3 6l5-3 5 3v3c0 2.4-2.2 4-5 4s-5-1.6-5-4V6z" /><path d="M6.4 8.2l1.2 1.2 2.6-2.6" /></svg>,
    tax:       <svg {...common}><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M5.5 5.5h5 M5.5 8h5 M5.5 10.5h3" /></svg>,
    settings:  <svg {...common}><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.4 3.4l1.4 1.4 M11.2 11.2l1.4 1.4 M3.4 12.6l1.4-1.4 M11.2 4.8l1.4-1.4" /></svg>,
    docs:      <svg {...common}><path d="M4 2.5h6l3 3v8H4v-11z" /><path d="M10 2.5v3h3" /><path d="M6 8h5 M6 10.5h5 M6 5.5h2" /></svg>,
    search:    <svg {...common}><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2L13 13" /></svg>,
    bell:      <svg {...common}><path d="M4 11V7.5a4 4 0 1 1 8 0V11l1 1.5H3L4 11z" /><path d="M6.5 14a1.5 1.5 0 0 0 3 0" /></svg>,
    chev:      <svg {...common}><path d="M5.5 4.5L9.5 8l-4 3.5" /></svg>,
    chevDn:    <svg {...common}><path d="M4 6l4 4 4-4" /></svg>,
    plus:      <svg {...common}><path d="M8 2.5v11 M2.5 8h11" /></svg>,
    arrow:     <svg {...common}><path d="M3.5 8h9 M9 4.5L12.5 8 9 11.5" /></svg>,
    arrowUR:   <svg {...common}><path d="M5 11L11 5 M5.5 5h5.5v5.5" /></svg>,
    check:     <svg {...common}><path d="M3 8.4L6.2 11 13 4.5" /></svg>,
    x:         <svg {...common}><path d="M3.5 3.5l9 9 M12.5 3.5l-9 9" /></svg>,
    info:      <svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 6v0.01 M8 8v3.5" /></svg>,
    copy:      <svg {...common}><rect x="5" y="2.5" width="8" height="8" rx="1" /><path d="M5 5H3.5v8H11v-1.5" /></svg>,
    download:  <svg {...common}><path d="M8 2.5v8.5 M4.5 7.5L8 11l3.5-3.5" /><path d="M3 13.5h10" /></svg>,
    refresh:   <svg {...common}><path d="M3 8a5 5 0 0 1 9-3l1 1.2 M13 8a5 5 0 0 1-9 3l-1-1.2" /><path d="M13 3v3.2h-3.2 M3 13v-3.2h3.2" /></svg>,
    venue:     <svg {...common}><rect x="2.5" y="4" width="11" height="9" /><path d="M5 4V2.5h6V4 M2.5 7h11" /></svg>,
    spark:     <svg {...common}><path d="M2 11l3-4 2.5 2.5 3.5-5.5 3 7" /></svg>,
    shield:    <svg {...common}><path d="M3 4l5-2 5 2v4c0 2.7-2.3 5-5 6-2.7-1-5-3.3-5-6V4z" /></svg>
  };
  return icons[name] || <span style={{ width: s, height: s }} />;
};

const Pill = ({ kind = "live", children }) => (
  <span className={"pill " + (kind === "testnet" ? "testnet" : "")}>
    <span className="dot" />
    {children || (kind === "testnet" ? "testnet" : "live")}
  </span>
);

const Tag = ({ tone = "neutral", children }) => (
  <span className={"tag " + (tone === "green" ? "green" : tone === "red" ? "red" : tone === "amber" ? "amber" : "")}>
    {children}
  </span>
);

/* Toast system */
const useToast = () => {
  const [toast, setToast] = useState(null);
  const show = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  return [toast, show];
};

const Toast = ({ msg }) => msg ? <div className="toast" key={msg}>{msg}</div> : null;

/* Avatar — deterministic gradient from a string */
const Avatar = ({ seed = "atrium", size = 22 }) => {
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    return h;
  }, [seed]);
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size, borderRadius: 999,
      background: `linear-gradient(135deg, oklch(60% 0.14 ${hash}deg) 0%, oklch(40% 0.10 ${(hash + 120) % 360}deg) 100%)`,
      flexShrink: 0
    }} />
  );
};

/* Subtle sparkline (line only, no fill) */
const Spark = ({ data, w = 80, h = 24, pos }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <path d={pts} fill="none" stroke={pos ? "var(--live)" : (pos === false ? "var(--neg)" : "var(--ink)")} strokeWidth="1.2" />
    </svg>
  );
};

/* Synthetic sparkline data */
const synthSpark = (seed = 1, len = 24, trend = 0) => {
  const out = []; let v = 1;
  for (let i = 0; i < len; i++) {
    v += Math.sin(i * 0.3 + seed) * 0.05 + (trend * i / len) + (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 0.06;
    out.push(v);
  }
  return out;
};

/* Address copier */
const AddressChip = ({ address, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button onClick={copy} className="addr-chip" title="Copy address">
      {label && <span className="muted" style={{ marginRight: 6 }}>{label}</span>}
      <span className="mono" style={{ fontSize: 11.5 }}>{shorten(address)}</span>
      <Icon name={copied ? "check" : "copy"} size={12} />
      <style>{`
        .addr-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 9px; border-radius: 999px;
          border: 1px solid var(--hairline); background: var(--bg-raised);
          color: var(--ink-soft); font-family: var(--sans);
          cursor: pointer; font-size: 12px;
          transition: border-color 120ms ease, color 120ms ease;
        }
        .addr-chip:hover { border-color: var(--ink); color: var(--ink); }
      `}</style>
    </button>
  );
};

/* Empty state */
const Empty = ({ title, sub, action }) => (
  <div style={{
    padding: "48px 24px", textAlign: "center", color: "var(--muted)",
    border: "1px dashed var(--line)", borderRadius: 12, background: "var(--bg-sunk)"
  }}>
    <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{title}</div>
    {sub && <div style={{ marginTop: 6, fontSize: 13 }}>{sub}</div>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

/* Stat card */
const StatCard = ({ label, value, sub, accent }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={accent ? { color: "var(--live)" } : null}>{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

Object.assign(window, {
  Wordmark, Icon, Pill, Tag, Toast, useToast, Avatar, Spark, synthSpark, AddressChip, Empty, StatCard
});
