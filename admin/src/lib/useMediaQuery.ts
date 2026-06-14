"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Returns false during SSR and the first
 * client render (so hydration matches), then updates after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Phone-sized viewports (≤ 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

/** Tablet and below (≤ 1024px) — for layouts that need an earlier breakpoint. */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 1024px)");
}
