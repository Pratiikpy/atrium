import Link from 'next/link';
import { AppShellActions } from './app-shell-actions';
import { AppShellWalletCard } from './app-shell-wallet-card';
import { WrongChainBanner } from './wrong-chain-banner';

/**
 * AppShell (2026-05-28).
 *
 * Wraps every /app/* page with the premium shell:
 *
 *   - 248px sticky sidebar (search + 4 nav sections + wallet card)
 *   - 56px sticky topbar (breadcrumb + LIVE/TESTNET pills + actions)
 *   - 1480px max-width `.view` content area
 *
 * Mobile: at < 768px the `.atrium-mobile-only` branch renders a
 * minimal chrome wrapping the same {children} content. No separate
 * MobileApp component — the Lovable-port was deleted in Phase 1.
 *
 * Prop interface: { children, active, breadcrumb? }.
 */

const NAV_GROUPS = [
  {
    heading: 'Trade',
    items: [
      { href: '/app/portfolio', label: 'Portfolio', icon: 'rect' },
      { href: '/app/markets',   label: 'Markets',   icon: 'graph' },
      { href: '/app/trade',     label: 'Trade',     icon: 'graph' },
      { href: '/app/transfer',  label: 'Transfer',  icon: 'arrows' },
    ],
  },
  {
    heading: 'Agents',
    items: [
      { href: '/app/agents', label: 'Agents', icon: 'agent' },
      { href: '/app/integrations', label: 'Integrations', icon: 'graph' },
    ],
  },
  {
    heading: 'Trust',
    items: [
      // Audit fix (#51): the nav badge was a hardcoded "✓" implying reserves are
      // always verified-fresh. That is a static claim, not live state - the real
      // freshness lives on /app/reserves (the stat row flips to STALE from
      // /api/reserves/summary). Dropped the false always-✓ rather than assert it.
      { href: '/app/reserves', label: 'Reserves', icon: 'shield' },
      { href: '/app/tax',      label: 'Tax',      icon: 'doc' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/app/notifications', label: 'Notifications', icon: 'bell' },
      { href: '/app/settings',      label: 'Settings',      icon: 'gear' },
    ],
  },
] as const;

interface TopbarProps {
  breadcrumb: { label: string; href?: string }[];
}

export function AppShell({
  children,
  active,
  breadcrumb,
}: {
  children: React.ReactNode;
  active?: string;
  breadcrumb?: TopbarProps['breadcrumb'];
}) {
  return (
    <>
      {/* Mobile branch: minimal chrome wrapping the
          actual page content. Renders `{children}` directly — every
          /app/* route shows its own real-data content on mobile. */}
      <div className="atrium-mobile-only" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header
          className="atrium-nav"
          style={{ position: 'sticky', top: 0, zIndex: 50, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}
        >
          <Link href="/" className="atrium-mark" style={{ fontSize: 20, textDecoration: 'none' }}>
            Atrium
          </Link>
          <span className="pill testnet" style={{ fontSize: 9 }}>
            <span className="dot" />
            testnet
          </span>
        </header>
        <main style={{ padding: '16px', paddingBottom: '80px' }}>{children}</main>
      </div>

      {/* Desktop branch: Lovable `.atrium-app` sidebar + topbar + view. */}
      <div className="atrium-desktop-only atrium-app">
        <WrongChainBanner />
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="side">
          <div className="side-brand">
            <Link href="/app" className="atrium-mark" style={{ fontSize: 22, textDecoration: 'none' }}>
              Atrium
            </Link>
            <span className="pill testnet">
              <span className="dot" />
              testnet
            </span>
          </div>

          <div className="side-search">
            <SearchIcon />
            <span>Search · positions, agents</span>
            <kbd className="kbd">⌘K</kbd>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="side-section">
              <div className="side-section-head">{group.heading}</div>
              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={'side-link' + (isActive ? ' active' : '')}
                  >
                    <span className="si"><NavIcon kind={item.icon} /></span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="side-foot">
            <AppShellWalletCard />
          </div>
        </aside>

        {/* ── Main column ────────────────────────────────────────── */}
        <div className="app-main">
          {/* Topbar */}
          <div className="topbar">
            <div className="crumb">
              {(breadcrumb ?? [{ label: 'Atrium' }]).map((b, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  {i > 0 && <span className="crumb-sep">·</span>}
                  {b.href ? (
                    <Link href={b.href as any} className={i === 0 ? 'crumb-main' : 'crumb-sub'}>
                      {b.label}
                    </Link>
                  ) : (
                    <span className={i === 0 ? 'crumb-main' : 'crumb-sub'}>{b.label}</span>
                  )}
                </span>
              ))}
            </div>
            <div className="topbar-right">
              <AppShellActions />
            </div>
          </div>

          {/* View content */}
          <div className="view">{children}</div>
        </div>
      </div>
    </>
  );
}

// Inline icons matching Lovable's thin-stroke set
function NavIcon({ kind }: { kind: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'rect':
      return (<svg {...common}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6h12" /></svg>);
    case 'graph':
      return (<svg {...common}><path d="M2 12L6 8L9 10L14 4" /></svg>);
    case 'arrows':
      return (<svg {...common}><path d="M3 5h10M11 3l2 2-2 2M13 11H3M5 9l-2 2 2 2" /></svg>);
    case 'agent':
      return (<svg {...common}><circle cx="8" cy="6" r="2.5" /><path d="M3 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" /></svg>);
    case 'shield':
      return (<svg {...common}><path d="M8 2L13 4v4c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V4z" /></svg>);
    case 'doc':
      return (<svg {...common}><path d="M4 2h6l3 3v9H4z" /><path d="M10 2v3h3" /></svg>);
    case 'gear':
      return (<svg {...common}><circle cx="8" cy="8" r="2.5" /><path d="M8 1v1.5M8 13.5V15M3.5 3.5l1 1M11.5 11.5l1 1M1 8h1.5M13.5 8H15M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>);
    case 'bell':
      return (<svg {...common}><path d="M8 2v1M4 6a4 4 0 1 1 8 0c0 2.5 1 4 1 5H3c0-1 1-2.5 1-5zM6.5 13a1.5 1.5 0 0 0 3 0" /></svg>);
    default:
      return null;
  }
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </svg>
  );
}
