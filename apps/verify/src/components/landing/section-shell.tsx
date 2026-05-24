import type { ReactNode } from 'react';

/**
 * SectionShell — the eyebrow / headline / sub lockup that every marketing
 * section uses. Matches the `.section-head.centered` pattern from
 * desing/Atrium.html. Optional `variant="dark"` flips to the inverse Sigil
 * section colors.
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
      className={
        'border-t ' +
        (isDark
          ? 'section-dark border-ink-darkest'
          : 'border-divider bg-parchment')
      }
    >
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="section-head centered mx-auto max-w-3xl text-center">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="mt-3 font-display text-4xl italic md:text-[42px]" style={{ letterSpacing: '-0.02em' }}>
            {headline}
          </h2>
          {sub && (
            <p
              className={
                'section-sub mx-auto mt-5 max-w-prose text-lg ' +
                (isDark ? 'text-dark-white-55' : 'text-ink-soft')
              }
            >
              {sub}
            </p>
          )}
        </div>
        {children && <div className="mt-12 md:mt-16">{children}</div>}
      </div>
    </section>
  );
}
