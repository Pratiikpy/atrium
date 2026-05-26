'use client';

import { useState } from 'react';
import { AgentLeaderboard } from './leaderboard';
import { MyMandatesPanel } from './my-mandates-panel';
import { SessionKeysPanel } from './session-keys-panel';
import { ActionLogPanel } from './action-log-panel';

const TABS = [
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'my-mandates', label: 'My mandates' },
  { id: 'session-keys', label: 'Session keys' },
  { id: 'action-log', label: 'Action log' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Parent client view for /app/agents. Owns the tab state so all four
 * tabs actually switch the rendered content — the old AgentTabBar was a
 * dead control: it toggled visual state but always showed Marketplace.
 *
 * Pixel-matched to `design/Atrium App.standalone.html` file10.js (Agents).
 */
export function AgentsView() {
  const [tab, setTab] = useState<TabId>('marketplace');

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-divider">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                'rounded-t-md px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ' +
                (isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === 'marketplace' && <AgentLeaderboard />}
        {tab === 'my-mandates' && <MyMandatesPanel />}
        {tab === 'session-keys' && <SessionKeysPanel />}
        {tab === 'action-log' && <ActionLogPanel />}
      </div>
    </>
  );
}
