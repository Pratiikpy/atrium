/**
 * Session keys tab, Postern ERC-7715 session keys owned by the connected
 * wallet. Currently honest pending because the subgraph schema doesn't yet
 * include a PosternSessionKey entity (see `subgraph/indexing-todo.md`).
 *
 * Once the entity ships, the route would be /api/agents/session-keys with
 * the same shape as my-mandates: `{ keys: SessionKey[], source: 'scribe' }`.
 * Until then this panel renders the prototype's shape with an honest
 * named-pending state, never a fake list.
 */
export function SessionKeysPanel() {
  return (
    <div className="rounded-md border border-divider bg-parchment-soft/30 px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">Session keys indexing pending</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        Postern session-key events aren&rsquo;t in the Scribe subgraph yet -
        the entity is tracked in{' '}
        <code className="font-mono text-ink">subgraph/indexing-todo.md</code>.
        Once the schema adds <code className="font-mono text-ink">PosternSessionKey</code>{' '}
        and the contracts deploy (Month 1 W2), this tab will list each active
        session key with its scope, expiry, and an Arbiscan link to the
        issuance tx.
      </p>
    </div>
  );
}
