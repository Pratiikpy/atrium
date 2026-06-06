'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 5-tab glass-blur bottom navigation. Source: design/Mobile App.html:1321-1352.
 * Backdrop blur with hairline top border. Active tab has higher ink + a soft
 * accent halo. Each tab maps to a real /app/* route.
 *
 * Tab map (matches the canon Mobile App panels):
 *   Home    -> /app/portfolio
 *   Trade   -> /app/trade
 *   Move    -> /app/transfer
 *   Agents  -> /app/agents
 *   More    -> /app/settings (entry point to wallet + reserves + tax)
 */
const TABS = [
  { href: '/app/portfolio', label: 'Home', icon: HomeIcon },
  { href: '/app/trade',     label: 'Trade', icon: TradeIcon },
  { href: '/app/transfer',  label: 'Move', icon: MoveIcon },
  { href: '/app/agents',    label: 'Agents', icon: AgentsIcon },
  { href: '/app/settings',  label: 'More', icon: MoreIcon },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      className="fixed inset-x-0 z-40 grid grid-cols-5 border-t border-mob-hairline bg-mob-bg/85 backdrop-blur-xl transition-[bottom] duration-200"
      style={{ bottom: 'var(--consent-h, 0px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      aria-label="Primary"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
          || (href === '/app/settings' && (pathname.startsWith('/app/settings') || pathname.startsWith('/app/notifications') || pathname.startsWith('/app/reserves') || pathname.startsWith('/app/tax')));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 pt-2 pb-1 text-[10px] uppercase tracking-wider transition-colors ${
              isActive ? 'text-mob-ink' : 'text-mob-muted hover:text-mob-ink-soft'
            }`}
          >
            <span className={`grid size-7 place-items-center transition-transform ${isActive ? 'scale-110' : ''}`}>
              <Icon active={isActive} />
            </span>
            <span>{label}</span>
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-[2px] bg-mob-accent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" />
    </svg>
  );
}

function TradeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17l5-6 4 4 5-7 4 5" />
      <path d="M3 21h18" />
    </svg>
  );
}

function MoveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 20l-4-4 4-4" />
    </svg>
  );
}

function AgentsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
