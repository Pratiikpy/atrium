'use client';

import { useEffect, useRef, useState } from "react";

/**
 * Tween a numeric value toward `value` on change (Lovable port).
 * Uses requestAnimationFrame with cubic-out easing. Prevents the layout
 * jitter of hard swaps. Respects prefers-reduced-motion.
 */
export function useTweenNumber(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    fromRef.current = display;
    startRef.current = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / duration);
      const next = fromRef.current + (value - fromRef.current) * ease(t);
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}
