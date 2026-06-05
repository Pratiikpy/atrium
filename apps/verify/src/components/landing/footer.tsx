import Link from 'next/link';

/**
 * Landing-page footer. 4-column layout matching
 * `design/Atrium.html` file3.js (`Footer` component, lines 889–923).
 *
 * Column order is canon: Product · Subsystems · Resources · Company.
 *
 * Honest-link discipline: the prototype renders every row as `<a href="#">`
 * with no real destination. We do better, anchor every item to a real
 * page where one exists, and render the row as plain text (no Link) where
 * the destination doesn't exist yet. Better to ship a non-clickable label
 * than a dead 404 link.
 *
 * The footer baseline matches the prototype: copyright + chain ids + the
 * status dot. Chain ids and the status dot are placeholders until the
 * deployment registry has real values, until then, render `pending`.
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
      { label: 'Honest disclosures', href: '/docs/honesty' },
      { label: 'Architecture', href: '/#architecture' },
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
      { label: 'Bug bounty', href: '/security/bounty' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'KYC disclosure', href: '/legal/kyc' },
      { label: 'Sub-processors', href: '/legal/sub-processors' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-divider bg-parchment">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-6">
        <div className="md:col-span-1">
          <p className="font-display text-2xl italic text-ink">Atrium</p>
          <p className="mt-3 max-w-xs text-sm text-ink-soft">
            Unified margin prime brokerage for the EVM.
            <br />
            <span className="text-muted">
              {/* Honesty fix: prior copy claimed "Live on Robinhood Chain
                 testnet". The RH SDK is not public yet, so the adapter
                 cannot ship. The honest statement is the single-chain one
                 with the RH adapter named as pending. */}
              Live on Arbitrum Sepolia. Robinhood Chain adapter ships
              within 14 days of the RH SDK going public.
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
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-4 text-xs text-muted md:flex-row md:items-center">
          <span>© 2026 Atrium · testnet on Arbitrum Sepolia · no real funds at risk</span>
          <div className="flex items-center gap-3">
            {/* Honesty audit (2026-06-05): removed GitHub, Twitter, and Farcaster
                social links, those accounts are not registered/owned yet, so a
                link would point at a 404 or a stranger's handle. Discord stays
                as an honest "launching with testnet" pointer to /security. Add
                each social back only when the real account exists. */}
            <SocialLink href="/security" label="Discord, launching with testnet">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M13.55 3a13 13 0 00-3.2-1l-.16.32a12 12 0 00-3.4 0L6.65 2A13 13 0 003.45 3 13.5 13.5 0 001 11a13.2 13.2 0 004 2 9.5 9.5 0 00.84-1.36 8.5 8.5 0 01-1.32-.64l.33-.24a9.4 9.4 0 008.3 0l.33.24a8.4 8.4 0 01-1.33.64A9.5 9.5 0 0011 13a13.2 13.2 0 004-2A13.5 13.5 0 0013.55 3zM5.85 9.4c-.78 0-1.42-.72-1.42-1.6s.62-1.6 1.42-1.6c.79 0 1.43.73 1.42 1.6 0 .88-.63 1.6-1.42 1.6zm4.3 0c-.79 0-1.43-.72-1.43-1.6s.63-1.6 1.42-1.6c.79 0 1.42.73 1.42 1.6 0 .88-.63 1.6-1.42 1.6z" />
              </svg>
            </SocialLink>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <span className="size-1.5 rounded-full bg-[var(--color-status-amber)]" />
              testnet · contracts pending
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={label}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full border border-divider text-muted transition hover:border-ink/30 hover:text-ink"
    >
      {children}
    </a>
  );
}
