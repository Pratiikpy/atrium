'use client';

import { useEffect, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useTweenNumber } from "@/hooks/useTweenNumber";

export function Numbers() {
  const [tvl, setTvl] = useState(4.13);
  const [queries, setQueries] = useState(42109);
  const agents = 37;
  useEffect(() => {
    const t = setInterval(() => {
      setTvl((v) => v + (Math.random() - 0.4) * 0.005);
      setQueries((v) => v + Math.floor(Math.random() * 4));
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const tvlTween = useTweenNumber(tvl, 900);
  const queriesTween = useTweenNumber(queries, 900);

  return (
    <section className="numbers">
      <div className="container">
        <div className="numbers-grid">
          <NumberBig
            n={"$" + tvlTween.toFixed(2) + "M"}
            l="Live testnet TVL"
            sub="+ 41.2% vs 30d ago"
            delay={0}
          />
          <NumberBig n={agents.toString()} l="Registered agents" sub="8 with open positions" delay={80} />
          <NumberBig
            n={Math.round(queriesTween).toLocaleString()}
            l="Codex queries · 24h"
            sub="x402 micropayments"
            delay={160}
          />
          <NumberBig n="7 / 8" l="Venue adapters live" sub="6 native · 1 bridged · RH-Chain pending" delay={240} />
        </div>
      </div>
    </section>
  );
}

function NumberBig({ n, l, sub, delay = 0 }: { n: string; l: string; sub: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="number-big reveal"
      style={{ ["--delay" as string]: `${delay}ms` } as React.CSSProperties}
    >
      <div
        className="mono tnum"
        style={{ fontSize: "clamp(36px, 4vw, 56px)", letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        {n}
      </div>
      <div className="mono cap muted" style={{ marginTop: 14 }}>{l}</div>
      <div className="mono cap muted" style={{ marginTop: 4, opacity: 0.7 }}>{sub}</div>
    </div>
  );
}
