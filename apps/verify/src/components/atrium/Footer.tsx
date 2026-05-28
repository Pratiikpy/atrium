import Link from "next/link";
import { BrandWordmark } from "./brand";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--bg-sunk)]">
      <div className="container py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4">
            <BrandWordmark size={28} />
            <p className="max-w-xs text-[13.5px] text-[var(--ink-soft)]">
              Unified margin prime brokerage for the EVM. Testnet-first. Built on
              Arbitrum Sepolia with Chainlink CCIP, ERC-8004, and ERC-4337 / 7702.
            </p>
            <div className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              v0.15 · 2026.05 · testnet only
            </div>
          </div>
          <FootCol title="Product" links={[
            ["App", "/app"],
            ["Verifier walk", "/verify"],
            ["Reserves", "/lantern"],
            ["Docs", "/docs"],
          ]} />
          <FootCol title="Company" links={[
            ["Manifesto", "/manifesto"],
            ["Team", "/team"],
            ["Cohort", "/cohort"],
            ["Security", "/security"],
          ]} />
          <FootCol title="Resources" links={[
            ["Brand kit", "/brand"],
            ["Learn", "/learn"],
            ["Legal", "/legal/terms"],
          ]} />
        </div>
      </div>
      <div className="border-t border-[var(--hairline)]">
        <div className="container flex flex-col gap-3 py-6 text-[12px] text-[var(--muted)] sm:flex-row sm:justify-between">
          <div>© 2026 Atrium Labs Ltd · CC-BY-4.0 brand assets</div>
          <div className="mono uppercase tracking-[0.12em]">Testnet only · not investment advice</div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="cap mb-4">{title}</div>
      <ul className="flex flex-col gap-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-[13.5px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
