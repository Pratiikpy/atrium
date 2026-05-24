'use client';

import { useState, createContext, useContext, type ReactNode } from 'react';

/**
 * Settings subnav + tab context. Audit P-6 fix: prior version had 6 tabs
 * but only the "Wallet" cards rendered — clicking the other 5 silently
 * toggled `active` state with no visible effect.
 *
 * Now `SettingsTabs` provides a context so each section card can opt-in
 * to a specific tab. Tabs without rendered content show a "pending" pill
 * and a brief copy line explaining when the section ships.
 */

export type SettingsTabId =
  | 'wallet'
  | 'session-keys'
  | 'recovery'
  | 'network'
  | 'notifications'
  | 'account';

const TAB_CONTEXT = createContext<{ active: SettingsTabId } | null>(null);

const TABS: { id: SettingsTabId; label: string; icon: string; readyMonth?: string }[] = [
  { id: 'wallet', label: 'Wallet', icon: '✦' },
  { id: 'session-keys', label: 'Session keys', icon: '◉', readyMonth: 'Month 2 W1' },
  { id: 'recovery', label: 'Recovery', icon: '◐', readyMonth: 'Month 8' },
  { id: 'network', label: 'Network', icon: '⇌', readyMonth: 'Month 3' },
  { id: 'notifications', label: 'Notifications', icon: '♬', readyMonth: 'Month 5' },
  { id: 'account', label: 'Account', icon: '◌', readyMonth: 'Month 4' },
];

export function SettingsTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<SettingsTabId>('wallet');
  const tabMeta = TABS.find((t) => t.id === active);
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="space-y-0.5">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ' +
                (isActive
                  ? 'bg-ink text-parchment'
                  : 'text-ink-soft hover:bg-parchment-soft/60 hover:text-ink')
              }
            >
              <span aria-hidden className="text-xs opacity-70">{t.icon}</span>
              <span>{t.label}</span>
              {t.readyMonth && !isActive && (
                <span className="ml-auto text-[9px] uppercase tracking-wider text-muted">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <TAB_CONTEXT.Provider value={{ active }}>
        <div className="space-y-4">
          {tabMeta?.readyMonth && active !== 'wallet' && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-5 text-sm">
              <p className="font-medium text-warning">{tabMeta.label} — coming {tabMeta.readyMonth}</p>
              <p className="mt-1 text-ink-soft">
                The {tabMeta.label.toLowerCase()} tab is scaffolded but not yet wired.
                See <code className="font-mono">docs/ROADMAP.md</code> for the exact ship date.
              </p>
            </div>
          )}
          {children}
        </div>
      </TAB_CONTEXT.Provider>
    </div>
  );
}

/**
 * Section helper: only renders its children when its tab is active.
 *
 * IMPORTANT — Audit R-4 fix: `SettingsTabPanel` MUST stay in this
 * `'use client'` file. The function reads `TAB_CONTEXT` via `useContext`,
 * which is a React-runtime call that only works in client components.
 * If you refactor this helper into a separate file or into a server
 * component (it *looks* pure — just a context read + return children),
 * runtime will fail with `useContext is not a function` the moment a
 * server component tries to render it. Do not split.
 */
export function SettingsTabPanel({ tab, children }: { tab: SettingsTabId; children: ReactNode }) {
  const ctx = useContext(TAB_CONTEXT);
  if (!ctx || ctx.active !== tab) return null;
  return <>{children}</>;
}
