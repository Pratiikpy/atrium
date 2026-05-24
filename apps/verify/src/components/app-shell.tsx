import Link from 'next/link';
import { AppShellActions } from './app-shell-actions';
import { AppShellWalletCard } from './app-shell-wallet-card';

/**
 * AppShell — left-sidebar chrome wrapping every `/app/*` page.
 *
 * Pixel-aligned to `desing/Atrium App.standalone.html` per the playwright
 * extraction. Layout:
 *
 *   ┌─────────────┬──────────────────────────────────────────────┐
 *   │ Atrium TEST │ Topbar: breadcrumb · status · refresh · CTA │
 *   │ Search ⌘K   ├──────────────────────────────────────────────┤
 *   │ ─────────── │                                              │
 *   │ TRADE       │                                              │
 *   │ Portfolio   │              Main content                   │
 *   │ Trade       │                                              │
 *   │ Transfer    │                                              │
 *   │             │                                              │
 *   │ AGENTS      │                                              │
 *   │ Agents   3  │                                              │
 *   │             │                                              │
 *   │ TRUST       │                                              │
 *   │ Reserves ✓  │                                              │
 *   │ Tax         │                                              │
 *   │             │                                              │
 *   │ ACCOUNT     │                                              │
 *   │ Settings    │                                              │
 *   │             │                                              │
 *   │ 0x…wallet…  │                                              │
 *   └─────────────┴──────────────────────────────────────────────┘
 *
 * Section header eyebrows are uppercase muted text. Active items have a
 * dark filled background. The wallet card at the bottom shows the address
 * + chain context.
 */

// Audit 2026-05-24 H-3 fix: prior nav omitted /app/markets and
// /app/notifications even though both routes exist under src/app/app/.
// Adding them lets users discover the surfaces without typing the URL.
const NAV_GROUPS = [
  {
    heading: 'Trade',
    items: [
      { href: '/app/portfolio', label: 'Portfolio', icon: 'rect' },
      { href: '/app/markets', label: 'Markets', icon: 'graph' },
      { href: '/app/trade', label: 'Trade', icon: 'graph' },
      { href: '/app/transfer', label: 'Transfer', icon: 'arrows' },
    ],
  },
  {
    heading: 'Agents',
    items: [{ href: '/app/agents', label: 'Agents', icon: 'agent', badge: '0' }],
  },
  {
    heading: 'Trust',
    items: [
      { href: '/app/reserves', label: 'Reserves', icon: 'shield', badge: '✓' },
      { href: '/app/tax', label: 'Tax', icon: 'doc' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/app/notifications', label: 'Notifications', icon: 'bell' },
      { href: '/app/settings', label: 'Settings', icon: 'gear' },
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
    <div className="flex min-h-screen bg-parchment text-ink">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-divider md:flex">
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/app" className="font-display text-2xl italic text-ink">
            Atrium
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-status-amber)]/30 bg-[var(--color-status-amber)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-status-amber)]">
            <span className="size-1.5 rounded-full bg-[var(--color-status-amber)]" />
            testnet
          </span>
        </div>

        {/* Search */}
        <div className="mx-5 mt-1 flex items-center gap-2 rounded-md border border-divider bg-parchment-light px-3 py-2 text-xs text-muted">
          <SearchIcon />
          <span className="flex-1 truncate">Search · positions, agents</span>
          <kbd className="rounded border border-divider px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </div>

        <nav className="mt-6 flex-1 space-y-6 px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-label">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = active === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ' +
                          (isActive
                            ? 'bg-ink text-parchment'
                            : 'text-ink-soft hover:bg-parchment-soft/60 hover:text-ink')
                        }
                      >
                        <span aria-hidden className="size-3.5 shrink-0 opacity-70">
                          <NavIcon kind={item.icon} active={isActive} />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {('badge' in item) && item.badge && (
                          <span
                            className={
                              'shrink-0 rounded px-1 py-0.5 text-[10px] ' +
                              (isActive ? 'bg-parchment/15 text-parchment' : 'text-muted')
                            }
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Wallet card: split out as a client component so it can read the
           live wagmi account (audit 2026-05-24 H-2 fix). */}
        <AppShellWalletCard />
      </aside>

      {/* ── Main column ────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-divider bg-parchment/85 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 items-baseline gap-2 text-sm">
            {(breadcrumb ?? [{ label: 'Atrium' }]).map((b, i) => (
              <span key={i} className="flex items-baseline gap-2">
                {i > 0 && <span className="text-muted">·</span>}
                {b.href ? (
                  <Link href={b.href as any} className="text-ink-soft hover:text-ink">
                    {b.label}
                  </Link>
                ) : (
                  <span className={i === 0 ? 'font-medium text-ink' : 'text-ink-soft'}>{b.label}</span>
                )}
              </span>
            ))}
          </div>
          {/* Audit P-11 fix: actions split into a client component so
              Refresh actually invalidates the React Query cache instead of
              being a dead button. */}
          <AppShellActions />
        </header>

        {/* Mobile nav strip (no sidebar on small screens) */}
        <nav className="border-b border-divider md:hidden">
          <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {NAV_GROUPS.flatMap(
              (g) =>
                g.items as readonly {
                  href: string;
                  label: string;
                  icon: string;
                  badge?: string;
                }[],
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href as any}
                className={
                  'shrink-0 rounded-md px-3 py-2 text-sm min-h-[44px] inline-flex items-center ' +
                  (active === item.href ? 'bg-ink text-parchment' : 'text-ink-soft')
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="flex-1 px-6 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}

// ── Inline icons (lucide-react replaced with hand-drawn SVGs to match
// the design's thin-stroke set without pulling lucide into this bundle) ──

function NavIcon({ kind, active }: { kind: string; active?: boolean }) {
  const stroke = active ? 'currentColor' : 'currentColor';
  const sw = 1.5;
  const common = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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
    default:
      return null;
  }
}
function SearchIcon() {
  return (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3 3" /></svg>);
}
