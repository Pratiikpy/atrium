import Link from 'next/link';

/**
 * Landing-page footer. 4-column layout matching
 * `desing/Atrium.html` file3.js (`Footer` component, lines 889–923).
 *
 * Column order is canon: Product · Subsystems · Resources · Company.
 *
 * Honest-link discipline: the prototype renders every row as `<a href="#">`
 * with no real destination. We do better — anchor every item to a real
 * page where one exists, and render the row as plain text (no Link) where
 * the destination doesn't exist yet. Better to ship a non-clickable label
 * than a dead 404 link.
 *
 * The footer baseline matches the prototype: copyright + chain ids + the
 * status dot. Chain ids and the status dot are placeholders until the
 * deployment registry has real values — until then, render `pending`.
 */

interface FooterItem {
  label: string;
  href?: string;
}

interface FooterColumn {
  title: string;
  items: FooterItem[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    items: [
      { label: 'Portfolio', href: '/app/portfolio' },
      { label: 'Trade', href: '/app/trade' },
      { label: 'Cross-chain', href: '/app/transfer' },
      { label: 'Agents', href: '/app/agents' },
      { label: 'Reserves', href: '/app/reserves' },
    ],
  },
  {
    title: 'Subsystems',
    // These are technical-architecture pillars; each one anchors to the
    // landing section that explains it, where a section exists. Vigil,
    // Portico, Postern aren't broken out as landing sections (they live
    // inside the architecture diagram), so we leave them unlinked rather
    // than wire them to a 404.
    items: [
      { label: 'Plinth · margin', href: '/#portfolio' },
      { label: 'Vigil · risk' },
      { label: 'Portico · venues' },
      { label: 'Sigil · agents', href: '/#agents' },
      { label: 'Postern · wallet' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Architecture', href: '/#architecture' },
      { label: 'GitHub', href: 'https://github.com/Pratiikpy/atrium' },
      { label: 'Status', href: '/sla' },
      { label: 'Brand kit', href: '/brand' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Cohort partners', href: '/cohort' },
      { label: 'Adapter grants', href: '/rostrum' },
      { label: 'Manifesto', href: '/manifesto' },
      { label: 'Team', href: '/team' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-divider bg-parchment">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-5">
        <div className="md:col-span-1">
          <p className="font-display text-2xl italic text-ink">Atrium</p>
          <p className="mt-3 max-w-xs text-sm text-ink-soft">
            Unified margin prime brokerage for the EVM.
            <br />
            <span className="text-muted">
              Live on Arbitrum Sepolia and Robinhood Chain testnet.
            </span>
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[10px] uppercase tracking-wider text-muted">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.items.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    item.href.startsWith('http') ? (
                      <a
                        href={item.href}
                        className="text-ink-soft hover:text-ink"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href as any}
                        className="text-ink-soft hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    )
                  ) : (
                    <span className="text-muted" title="No destination yet">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-divider">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-4 text-xs text-muted md:flex-row md:items-center">
          <span>© 2026 Atrium · testnet on Arbitrum Sepolia · no real funds at risk</span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <span className="size-1.5 rounded-full bg-[var(--color-status-amber)]" />
            testnet · contracts pending
          </span>
        </div>
      </div>
    </footer>
  );
}
