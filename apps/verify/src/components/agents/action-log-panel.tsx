/**
 * Action log tab — per-agent action history for the connected wallet.
 *
 * Scribe currently has `Agent.totalActionsCount` (aggregate) but no
 * per-action entity. The honest answer is to surface the aggregate
 * + a named-pending state until the subgraph adds an `AgentAction`
 * entity capturing `(agent, owner, kind, tx, timestamp, ...)`.
 *
 * Once that entity ships:
 *   - Route: /api/agents/actions?owner=0x...
 *   - Returns: `{ actions: AgentAction[], source: 'scribe' }`
 *   - This panel renders a paginated time-sorted log with venue + outcome.
 */
export function ActionLogPanel() {
  return (
    <div className="rounded-md border border-divider bg-parchment-soft/30 px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">Per-action indexing pending</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        Scribe tracks aggregate <code className="font-mono text-ink">totalActionsCount</code>{' '}
        per agent, but per-action rows aren&rsquo;t in the schema yet — see{' '}
        <code className="font-mono text-ink">subgraph/indexing-todo.md</code>{' '}
        for the planned <code className="font-mono text-ink">AgentAction</code>{' '}
        entity. Once it lands, this tab will show every action your delegated
        agents have taken: venue, instrument, size, outcome, and tx link.
      </p>
    </div>
  );
}
