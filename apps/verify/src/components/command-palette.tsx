'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Audit fix (#46): the sidebar `.side-search` box with the ⌘K kbd was a purely
 * decorative div - no input, no handler, no palette. It implied a keyboard
 * shortcut that did nothing (a fake affordance the no-dead-buttons rule
 * forbids). This is the real command palette it promised: ⌘K / Ctrl+K (or
 * clicking the search box) opens a route switcher over the app's nav
 * destinations. Esc closes; ↑/↓ move; Enter navigates.
 *
 * Routes mirror NAV_GROUPS in app-shell.tsx (kept in sync manually - both are
 * small static lists). Positions/agents from the live data path can be folded
 * in later; the nav routes are the load-bearing surface the box advertised.
 */
interface Command {
  href: string;
  label: string;
  group: string;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { href: '/app/portfolio', label: 'Portfolio', group: 'Trade', keywords: 'positions margin collateral' },
  { href: '/app/markets', label: 'Markets', group: 'Trade', keywords: 'venues combos' },
  { href: '/app/trade', label: 'Trade', group: 'Trade', keywords: 'open position order' },
  { href: '/app/transfer', label: 'Transfer', group: 'Trade', keywords: 'bridge ccip move usdc' },
  { href: '/app/agents', label: 'Agents', group: 'Agents', keywords: 'mandate sigil delegate rostrum' },
  { href: '/app/integrations', label: 'Integrations', group: 'Agents', keywords: 'codex api' },
  { href: '/app/reserves', label: 'Reserves', group: 'Trust', keywords: 'proof lantern merkle' },
  { href: '/app/tax', label: 'Tax', group: 'Trust', keywords: 'cgt report uk' },
  { href: '/app/notifications', label: 'Notifications', group: 'Account', keywords: 'alerts' },
  { href: '/app/settings', label: 'Settings', group: 'Account', keywords: 'wallet session keys recovery' },
];

function matches(c: Command, q: string): boolean {
  if (!q) return true;
  const hay = `${c.label} ${c.group} ${c.keywords ?? ''} ${c.href}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => COMMANDS.filter((c) => matches(c, query)), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K toggle. Ignore when typing in another field so the
  // shortcut never hijacks an input the user is mid-edit in.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Focus the input + reset highlight whenever the palette opens.
  useEffect(() => {
    if (open) {
      setActive(0);
      // Focus after the element is mounted.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Keep the highlighted row in range as the result set shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[active];
      if (target) {
        close();
        router.push(target.href as never);
      }
    }
  }

  return (
    <>
      {/* Trigger: keeps the prototype's `.side-search` shape, now a real button. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="side-search"
        aria-label="Open command palette"
        style={{ width: '100%', textAlign: 'left', cursor: 'text', font: 'inherit' }}
      >
        <SearchIcon />
        <span>Search · positions, agents</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            background: 'rgba(20,18,16,0.45)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 92vw)',
              background: 'var(--bg-card, #fff)',
              border: '1px solid var(--hairline, rgba(0,0,0,0.1))',
              borderRadius: 14,
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--hairline, rgba(0,0,0,0.08))' }}>
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Jump to…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 15, color: 'var(--ink, #1A1714)' }}
              />
              <kbd className="kbd">esc</kbd>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 6, maxHeight: '52vh', overflowY: 'auto' }}>
              {results.length === 0 && (
                <li style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted, #8a857d)' }}>No matches</li>
              )}
              {results.map((c, i) => (
                <li key={c.href}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      close();
                      router.push(c.href as never);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      background: i === active ? 'var(--bg-elev, rgba(0,0,0,0.05))' : 'transparent',
                      color: 'var(--ink, #1A1714)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{c.label}</span>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #8a857d)' }}>{c.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </svg>
  );
}
