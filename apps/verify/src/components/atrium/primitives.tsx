'use client';

import type { ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

export function Pill({
  children,
  variant = "testnet",
  className = "",
}: {
  children: ReactNode;
  variant?: "testnet" | "live" | "neg";
  className?: string;
}) {
  return (
    <span className={`pill ${variant} ${className}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function Tag({
  children,
  variant,
  className = "",
}: {
  children: ReactNode;
  variant?: "green" | "amber" | "red";
  className?: string;
}) {
  return <span className={`tag ${variant ?? ""} ${className}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
  dense = false,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={`atrium-card ${dense ? "dense" : ""} ${className}`}>{children}</div>
  );
}

export function SectionHead({
  num,
  title,
  sub,
  right,
}: {
  num: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="section-head reveal">
      <div className="num">{num}</div>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "live" | "neg" | "amber";
}) {
  const subColor =
    accent === "live" ? "text-[var(--live)]"
    : accent === "neg" ? "text-[var(--neg)]"
    : accent === "amber" ? "text-[var(--testnet)]"
    : "text-[var(--muted)]";
  return (
    <Card>
      <div className="cap">{label}</div>
      <div className="num mt-3 text-[clamp(28px,3vw,40px)] font-medium tracking-tight text-[var(--ink)]">
        {value}
      </div>
      {sub ? <div className={`mono mt-2 text-[12px] ${subColor}`}>{sub}</div> : null}
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function StateBanner({
  kind,
  title,
  children,
  action,
}: {
  kind: "pending" | "error" | "success" | "info";
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const bg =
    kind === "pending" ? "bg-[color-mix(in_oklch,var(--testnet)_8%,transparent)] border-[color-mix(in_oklch,var(--testnet)_32%,transparent)]"
    : kind === "error" ? "bg-[color-mix(in_oklch,var(--neg)_8%,transparent)] border-[color-mix(in_oklch,var(--neg)_32%,transparent)]"
    : kind === "success" ? "bg-[color-mix(in_oklch,var(--live)_8%,transparent)] border-[color-mix(in_oklch,var(--live)_32%,transparent)]"
    : "bg-[var(--bg-raised)] border-[var(--hairline)]";
  return (
    <div className={`flex flex-col gap-3 rounded-[14px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${bg}`}>
      <div>
        <div className="text-[13.5px] font-medium text-[var(--ink)]">{title}</div>
        {children ? <div className="mt-1 text-[13px] text-[var(--ink-soft)]">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="atrium-card flex flex-col items-center gap-3 py-16 text-center">
      <div className="text-[16px] font-medium text-[var(--ink)]">{title}</div>
      {body ? <div className="max-w-md text-[13.5px] text-[var(--muted)]">{body}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function MockTxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`#explorer/${hash}`}
      onClick={(e) => e.preventDefault()}
      className="mono ulink text-[12px] text-[var(--ink-soft)]"
    >
      {hash} ↗
    </a>
  );
}
