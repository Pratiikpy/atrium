'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VENUES, fmtUSD } from "@/lib/atrium/static";
import { useTweenNumber } from "@/hooks/useTweenNumber";

/**
 * Impluvium — DOM port from Lovable matching the Atriumnew.html design.
 * Two rows of 4 venue cards bracket a central glass pool that shows the
 * unified buying-power figure. Animated SVG flow paths connect each card
 * to the pool. A scale rule and leverage slider live in the footer.
 */
export function Impluvium({
  initialLeverage = 3,
  showFlow = true,
}: {
  initialLeverage?: number;
  showFlow?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<HTMLDivElement | null>(null);
  const venueRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<{ id: string; d: string; isTop: boolean }[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [leverage, setLeverage] = useState(initialLeverage);

  // Honesty fix (2026-05-29 audit): this landing diagram previously ran a
  // setInterval that jittered the venue figures with Math.sin/cos to LOOK
  // like a live ticker, under a "live testnet feed" / green "Live" label.
  // That is the exact fake-live anti-pattern task #338 was closed to kill.
  // The landing page is allowed illustrative figures, but it must not
  // *pretend* they are live. Numbers are now static (no autonomous wobble);
  // the leverage slider below stays interactive (honest user input, not a
  // simulated feed), and the chrome is relabelled "illustrative schematic".
  const liveVenues = useMemo(
    () => VENUES.map((v) => ({ ...v, live: v.collateral })),
    [],
  );

  const totalCollateral = liveVenues.reduce((s, v) => s + (v.pending ? 0 : v.live), 0);
  const buyingPower = totalCollateral * leverage;
  const buyingPowerTween = useTweenNumber(buyingPower, 700);
  const totalCollateralTween = useTweenNumber(totalCollateral, 700);
  const maxC = Math.max(...VENUES.map((v) => v.collateral));
  const totalRef = VENUES.reduce((s, v) => s + v.collateral, 0);

  const recompute = useCallback(() => {
    const c = containerRef.current;
    const pool = poolRef.current;
    if (!c || !pool) return;
    const cBox = c.getBoundingClientRect();
    const pBox = pool.getBoundingClientRect();
    const px = pBox.left - cBox.left;
    const py = pBox.top - cBox.top;
    const next = VENUES.map((v) => {
      const el = venueRefs.current[v.id];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const isTop = b.top < pBox.top;
      const x1 = b.left + b.width / 2 - cBox.left;
      const y1 = isTop ? b.bottom - cBox.top : b.top - cBox.top;
      const x2 = px + pBox.width / 2;
      const y2 = isTop ? py : py + pBox.height;
      const midY = (y1 + y2) / 2;
      return {
        id: v.id,
        d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
        isTop,
      };
    }).filter(Boolean) as { id: string; d: string; isTop: boolean }[];
    setPaths(next);
  }, []);

  useEffect(() => {
    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  const top = liveVenues.slice(0, 4);
  const bot = liveVenues.slice(4);

  return (
    <div>
      <div className="draw-label">
        <div>
          <div className="mono cap">Fig. 01 · Capital convergence</div>
          <div className="mono cap muted" style={{ marginTop: 4 }}>
            Plan view · illustrative schematic
          </div>
        </div>
        <div className="mono cap" style={{ textAlign: "right" }}>
          <div>Sheet 02 / 08</div>
          <div className="muted" style={{ marginTop: 4 }}>Atrium Labs · May 2026</div>
        </div>
      </div>

      <div ref={containerRef} className="impluvium">
        <div className="impluvium-row">
          {top.map((v) => (
            <VenueCard
              key={v.id}
              v={v}
              hovered={hovered}
              setHovered={setHovered}
              refSet={(el) => (venueRefs.current[v.id] = el)}
              maxC={maxC}
              totalRef={totalRef}
            />
          ))}
        </div>

        <div className="impluvium-pool-row">
          <div ref={poolRef} className="pool">
            <PoolHatch />
            <div className="pool-corner top-left">Pool · Unified margin</div>
            <div className="pool-corner top-right">
              Schematic
            </div>
            <div className="pool-center">
              <div className="pool-figure tnum">{fmtUSD(buyingPowerTween)}</div>
              <div className="mono cap" style={{ marginTop: 12 }}>
                Buying power · {leverage.toFixed(1)}× portfolio margin
              </div>
            </div>
            <div className="pool-corner bot-left">
              Collateral{" "}
              <span className="mono tnum" style={{ marginLeft: 6, color: "var(--ink-soft)" }}>
                {fmtUSD(totalCollateralTween, { compact: true })}
              </span>
            </div>
            <div className="pool-corner bot-right">Plinth · margin ok</div>
          </div>
        </div>

        <div className="impluvium-row">
          {bot.map((v) => (
            <VenueCard
              key={v.id}
              v={v}
              hovered={hovered}
              setHovered={setHovered}
              refSet={(el) => (venueRefs.current[v.id] = el)}
              maxC={maxC}
              totalRef={totalRef}
            />
          ))}
        </div>

        <svg className="impluvium-flow" width="100%" height="100%">
          {paths.map((p) => {
            const isHover = hovered === p.id;
            return (
              <g key={p.id}>
                <path
                  d={p.d}
                  fill="none"
                  stroke={isHover ? "var(--accent)" : "var(--line)"}
                  strokeWidth={isHover ? 1.4 : 1}
                  style={{ transition: "stroke 160ms ease, stroke-width 160ms ease" }}
                />
                {showFlow && (
                  <path
                    d={p.d}
                    fill="none"
                    stroke={isHover ? "var(--accent)" : "var(--ink-soft)"}
                    strokeWidth={isHover ? 1.4 : 1}
                    strokeDasharray="2 8"
                    style={{
                      opacity: isHover ? 0.9 : 0.32,
                      animation: "atrium-flowDash 1.8s linear infinite",
                      animationDirection: p.isTop ? "normal" : "reverse",
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="draw-footer">
        <div className="scale-rule mono cap">
          <div className="scale-line">
            <span /><span /><span /><span /><span />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>0×</span><span>2×</span><span>4×</span><span>6×</span><span>8×</span><span>10×</span>
          </div>
        </div>
        <div className="leverage-control">
          <div className="mono cap muted">Portfolio margin</div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.1}
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            aria-label="Leverage"
          />
          <div className="mono" style={{ minWidth: 60, textAlign: "right" }}>
            {leverage.toFixed(1)}×
          </div>
        </div>
      </div>
    </div>
  );
}

type LiveVenue = (typeof VENUES)[number] & { live: number };

function VenueCard({
  v,
  hovered,
  setHovered,
  refSet,
  maxC,
  totalRef,
}: {
  v: LiveVenue;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  refSet: (el: HTMLDivElement | null) => void;
  maxC: number;
  totalRef: number;
}) {
  const isHover = hovered === v.id;
  const pct = (v.collateral / maxC) * 100;
  const share = (v.collateral / totalRef) * 100;
  return (
    <div
      ref={refSet}
      onMouseEnter={() => setHovered(v.id)}
      onMouseLeave={() => setHovered(null)}
      className={"venue-card" + (isHover ? " hover" : "")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "-0.005em" }}>{v.name}</div>
        <div className="mono cap" style={{ fontSize: 9.5 }}>{v.short}</div>
      </div>
      <div className="mono cap" style={{ marginTop: 3, fontSize: 9.5 }}>{v.type}</div>
      <div className="venue-num">{v.pending ? "—" : fmtUSD(v.live)}</div>
      <div className="venue-bar">
        <div
          style={{
            width: pct + "%",
            background: isHover ? "var(--accent)" : "var(--ink)",
          }}
        />
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span className="mono cap" style={{ fontSize: 9.5 }}>{v.asset}</span>
        <span className="mono cap" style={{ fontSize: 9.5 }}>{share.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function PoolHatch() {
  return (
    <svg className="pool-hatch" width="100%" height="100%">
      <defs>
        <pattern id="atrium-pool-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#atrium-pool-hatch)" />
    </svg>
  );
}
