import type { ReactNode } from 'react';

/**
 * SectionShell, the eyebrow / headline / sub lockup that every marketing
 * section uses. Ports the `.section-head.centered` pattern from
 * design/Atriumnew.html. Headings are Geist 500 (bold sans), matching
 * the design's headline treatment; the italic Instrument Serif accent
 * is reserved for emphasis words inside specific headings (e.g. the
 * hero's 'buying-power').
 *
 * Optional `variant="dark"` switches to the inverse palette for the
 * Agents section (and any other section that lands on `--dark-bg`).
 */
export function SectionShell({
  id,
  eyebrow,
  headline,
  sub,
  variant = 'light',
  children,
}: {
  id?: string;
  eyebrow?: string;
  headline: ReactNode;
  sub?: ReactNode;
  variant?: 'light' | 'dark';
  children?: ReactNode;
}) {
  const isDark = variant === 'dark';
  return (
    <section
      id={id}
      className={isDark ? 'border-t' : 'border-t'}
      style={
        isDark
          ? {
              backgroundColor: 'oklch(0.11 0.008 60)',
              color: 'oklch(0.96 0.003 60)',
              borderColor: 'oklch(0.22 0.006 60)',
            }
          : {
              backgroundColor: 'oklch(0.984 0.004 85)',
              color: 'oklch(0.13 0.008 60)',
              borderColor: 'oklch(0.88 0.004 60)',
            }
      }
    >
      <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-14 md:py-32">
        <div className="section-head centered mx-auto max-w-3xl text-center">
          {eyebrow && (
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: isDark ? 'oklch(0.72 0.004 60)' : 'oklch(0.54 0.005 60)' }}
            >
              {eyebrow}
            </p>
          )}
          {/* design/Atriumnew.html pattern: every section H2 ends with an
              italic-terracotta-serif accent on the trailing word. SectionShell
              wraps the headline so callers can pass an `accent` string that
              gets appended in the design's emphasis style. */}
          <h2
            className="mt-5 font-sans font-medium leading-[1.08] tracking-[-0.02em]"
            style={{
              fontSize: 'clamp(30px, 4vw, 48px)',
              color: isDark ? 'oklch(0.96 0.003 60)' : 'oklch(0.13 0.008 60)',
            }}
          >
            {headline}
          </h2>
          {sub && (
            <p
              className="mx-auto mt-6 max-w-prose text-lg leading-relaxed"
              style={{ color: isDark ? 'oklch(0.72 0.004 60)' : 'oklch(0.28 0.006 60)' }}
            >
              {sub}
            </p>
          )}
        </div>
        {children && <div className="mt-14 md:mt-16">{children}</div>}
      </div>
    </section>
  );
}
