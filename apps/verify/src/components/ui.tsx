/**
 * Shared UI primitives — Atrium design system.
 *
 * Every Atrium page composes from these. Tokens come from
 * `apps/verify/src/app/globals.css` which mirrors `desing/Atrium*.html`.
 * If a primitive disagrees with the design HTMLs, file an issue.
 *
 * Components in this file:
 *   <Card>           - default white-ish card with soft border
 *   <RecessedCard>   - parchment-soft fill for inset surfaces
 *   <WarningCard>    - amber accent for "not wired yet" / soft alerts
 *   <DangerCard>     - red accent for errors / pause / chaos
 *   <Stat>           - big-number tile (label + value + sub)
 *   <Row>            - label/value pair, used inside cards
 *   <Pill>           - status pill (amber/green/red) matching favicon
 *   <Block>          - section block with display-italic heading
 *   <PrimaryButton>  - the ink-on-parchment CTA
 *   <SecondaryButton>- bordered alternative
 *   <DangerButton>   - Kill-Switch / destructive
 *   <TextField>      - text/email/url input
 *   <NumberField>    - numeric input
 *   <SelectField>    - dropdown
 *   <Tag>            - small rounded label
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

// ──────────────────────────────────────────────────────────────────────
// Cards
// ──────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-divider bg-parchment p-6 ${className}`}>{children}</div>;
}

export function RecessedCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-divider bg-parchment-soft/40 p-6 ${className}`}>
      {children}
    </div>
  );
}

export function WarningCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-warning/30 bg-warning/5 p-6 ${className}`}>{children}</div>
  );
}

export function DangerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-danger/40 bg-danger/5 p-6 ${className}`}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Data display
// ──────────────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  sub,
  className = '',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function Row({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-between gap-3 ${className}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-mono text-ink">{value}</dd>
    </div>
  );
}

export function Pill({
  color,
  label,
}: {
  color: 'amber' | 'green' | 'red';
  label: string;
}) {
  const bg =
    color === 'amber'
      ? 'bg-[var(--color-status-amber)]'
      : color === 'green'
      ? 'bg-[var(--color-status-green)]'
      : 'bg-[var(--color-status-red)]';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-parchment px-3 py-1.5 text-xs text-ink">
      <span className={`size-2 rounded-full ${bg}`} aria-hidden />
      {label}
    </span>
  );
}

export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-divider bg-parchment px-2.5 py-1 text-xs text-muted ${className}`}
    >
      {children}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Layout
// ──────────────────────────────────────────────────────────────────────

export function Block({
  heading,
  children,
  className = '',
}: {
  heading: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <h2 className="font-display text-xl text-ink">{heading}</h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Buttons
// ──────────────────────────────────────────────────────────────────────

const BTN_BASE =
  'inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm min-h-[44px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export function PrimaryButton({
  children,
  href,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const classes = `${BTN_BASE} bg-ink text-parchment hover:bg-ink/90 ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href as any} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  href,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const classes = `${BTN_BASE} border border-divider bg-parchment text-ink hover:border-ink/30 ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href as any} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${BTN_BASE} bg-danger text-parchment hover:bg-danger/90 ${className}`}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Form fields
// ──────────────────────────────────────────────────────────────────────

const FIELD_BASE =
  'w-full rounded-md border border-divider bg-parchment px-4 py-3 text-sm text-ink min-h-[44px] placeholder:text-muted focus:border-ink/40 focus:outline-none';

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  monospace = false,
  className = '',
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: 'text' | 'email' | 'url';
  monospace?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs uppercase tracking-wider text-muted">{label}</span>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${FIELD_BASE} ${monospace ? 'font-mono' : ''} ${label ? 'mt-2' : ''}`}
      />
    </label>
  );
}

export function NumberField({
  label,
  placeholder,
  value,
  onChange,
  className = '',
}: {
  label?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs uppercase tracking-wider text-muted">{label}</span>}
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${FIELD_BASE} ${label ? 'mt-2' : ''}`}
      />
    </label>
  );
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label?: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs uppercase tracking-wider text-muted">{label}</span>}
      <select
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${FIELD_BASE} ${label ? 'mt-2' : ''}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
