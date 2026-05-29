import type { ReactNode } from "react";

/**
 * Feature section shell — eyebrow + centered title + product illustration.
 * Layout-only; no fake data.
 */
export function Feature({
  id,
  eyebrow,
  title,
  accent,
  sub,
  dark = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  accent?: ReactNode;
  sub?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={"feature" + (dark ? " dark" : "")}>
      <div className="container">
        <div className="section-head-centered">
          <div className="eyebrow mono cap">{eyebrow}</div>
          <h2 className="h2">
            {title} {accent && <span className="accent-grad">{accent}</span>}
          </h2>
          {sub && <p className="section-sub">{sub}</p>}
        </div>
        <div className="feature-stage">{children}</div>
      </div>
    </section>
  );
}
