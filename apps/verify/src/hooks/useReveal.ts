'use client';

import { useEffect, useRef } from "react";

/**
 * IntersectionObserver-driven reveal (Lovable port).
 * Adds [data-revealed="true"] when the element scrolls into view (once).
 * Pair with the `.reveal` CSS utility in globals.css.
 * Respects prefers-reduced-motion (auto-marks revealed).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.setAttribute("data-revealed", "true");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).setAttribute("data-revealed", "true");
          io.unobserve(e.target);
        }
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
