import type { ReactNode } from "react";
import { PublicNav } from "./PublicNav";
import { Footer } from "./Footer";

/**
 * MarketingShell (Lovable port, 2026-05-28), the unified marketing
 * chrome for every public-facing page that ISN'T the landing page.
 * Wraps page content in PublicNav + Footer. Page content is
 * automatically placed inside a Lovable `.container` for consistent
 * gutters and max-width.
 *
 * Apply to: /brand, /docs, /docs/api, /docs/honesty, /security,
 * /manifesto, /team, /cohort, /cohort/[id], /lantern, /lantern/sla,
 * /changelog, /verify/[step], /legal/privacy, /legal/terms.
 *
 * The hero offset (`pt-[68px]`) accounts for the sticky 68px tall nav
 * so content does not slide under it on first paint. `over-dark`
 * variant of PublicNav only activates when there's a `<section
 * id="hero">` in the page; for marketing-content pages without a hero
 * the nav stays in its light state.
 *
 * `nakedContent={true}` skips the .container wrapper if the page wants
 * its own full-bleed layout (e.g. /lantern with the merkle-tree
 * full-width SVG).
 */
export function MarketingShell({
  children,
  nakedContent = false,
}: {
  children: ReactNode;
  nakedContent?: boolean;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PublicNav />
      <main className="pt-[68px]">
        {nakedContent ? children : <div className="container py-16">{children}</div>}
      </main>
      <Footer />
    </div>
  );
}
