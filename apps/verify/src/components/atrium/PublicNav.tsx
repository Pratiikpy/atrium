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
export function PublicNav({ heroId = "hero" }: { heroId?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(false);

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

  return (
    <header
      className={`atrium-nav ${scrolled ? "scrolled" : ""} ${overDark ? "over-dark" : ""}`}
    >
      <div className="nav-inner">
        <Link href="/" className="inline-flex items-center" aria-label="Atrium home">
          <BrandWordmark size={22} />
        </Link>
        <nav className="nav-links">
          <Link href="/#portfolio" className="nav-link">Product</Link>
          <Link href="/#agents" className="nav-link">Agents</Link>
          <Link href="/lantern" className="nav-link">Reserves</Link>
          <Link href="/#system" className="nav-link">Subsystems</Link>
          <Link href="/docs" className="nav-link">Docs</Link>
        </nav>
        <div className="nav-right flex items-center gap-3">
          <Pill variant="testnet">testnet</Pill>
          <Link href="/app" className="btn sm">
            Open testnet <span className="arrow">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
