'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandWordmark } from "./brand";
import { Pill } from "./primitives";

/**
 * Public navigation header (Lovable port).
 * Sticky. Goes glass-blur when scrolled. Flips to over-dark variant
 * while the hero is in view (white wordmark + nav + button on dark bg).
 */
const NAV_LINKS = [
  { href: "/#portfolio-feature", label: "Product" },
  { href: "/#agents-feature", label: "Agents" },
  { href: "/architecture", label: "Architecture" },
  { href: "/lantern", label: "Reserves" },
  { href: "/docs", label: "Docs" },
] as const;

export function PublicNav({ heroId = "hero" }: { heroId?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(false);
  // Audit fix (#72): mobile menu open-state.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const hero = document.getElementById(heroId);
      if (hero) {
        const rect = hero.getBoundingClientRect();
        setOverDark(rect.bottom > 60);
      } else {
        setOverDark(false);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroId]);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header
      className={`atrium-nav ${scrolled ? "scrolled" : ""} ${overDark ? "over-dark" : ""}`}
    >
      <div className="nav-inner">
        <Link href="/" className="inline-flex items-center" aria-label="Atrium home">
          <BrandWordmark size={22} />
        </Link>
        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
          ))}
        </nav>
        <div className="nav-right flex items-center gap-3">
          <Pill variant="testnet">testnet</Pill>
          <Link href="/app" className="btn sm">
            Open testnet <span className="arrow">↗</span>
          </Link>
          {/* Audit fix (#72): hamburger toggle (mobile only via CSS). */}
          <button
            type="button"
            className="nav-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 5h12M3 9h12M3 13h12" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Audit fix (#72): mobile nav sheet. The 5 links were unreachable on
          phones (nav-links display:none, no hamburger). */}
      <nav className={`nav-mobile-sheet ${menuOpen ? "open" : ""}`} aria-label="Mobile navigation">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" onClick={() => setMenuOpen(false)}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
