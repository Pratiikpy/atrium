'use client';

/**
 * Pitch deck side progress rail. A fixed left-edge rail of dot + label
 * links, one per deck section, with the section currently in view marked
 * active via an IntersectionObserver. Optional polish only: the page is
 * fully readable and navigable without it. Styling uses the app's themed
 * tokens so the marketing-shell mobile token-flip renders it dark on
 * mobile automatically (and the CSS hides it below the rail breakpoint).
 */

import { useEffect, useState } from 'react';

type RailItem = { id: string; n: string; label: string };

export function PitchRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry nearest the top of the viewport that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="pitch-rail" aria-label="Deck sections">
      <ol className="pitch-rail-list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`pitch-rail-link ${active === item.id ? 'is-active' : ''}`}
              aria-current={active === item.id ? 'true' : undefined}
            >
              <span className="pitch-rail-dot" aria-hidden="true" />
              <span className="pitch-rail-n">{item.n}</span>
              <span className="pitch-rail-label">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
