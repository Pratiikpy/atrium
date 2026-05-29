export function TestnetPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-bg px-3 py-1 text-xs text-muted">
      <span className="size-1.5 rounded-full bg-[var(--color-status-amber)]" />
      Testnet · no real funds at risk
    </span>
  );
}
