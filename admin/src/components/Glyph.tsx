import React from "react";

// Mirrors the practa renderer's content-icon set (practa repo:
// src/components/icons.tsx). Kept here so the CMS can *preview* the icon an
// owner picks — these are the same SVGs the public site renders. Keep names +
// paths in sync with that file when icons are added or changed.

const ICONS: Record<string, React.ReactNode> = {
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  shield: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
  ),
  compass: (
    <>
      <circle cx={12} cy={12} r={10} />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  mail: (
    <>
      <rect x={2} y={4} width={20} height={16} rx={2} />
      <path d="m22 7-9.97 5.6a2 2 0 0 1-1.97 0L2 7" />
    </>
  ),
  phone: (
    <path d="M13.83 19.36a14.5 14.5 0 0 1-6.36-6.36l1.6-1.6a1.5 1.5 0 0 0 .36-1.53L8.6 6.7A1.5 1.5 0 0 0 7.18 5.7H4.5A1.5 1.5 0 0 0 3 7.3 16.5 16.5 0 0 0 16.7 21a1.5 1.5 0 0 0 1.6-1.5v-2.68a1.5 1.5 0 0 0-1-1.42l-3.17-1.23a1.5 1.5 0 0 0-1.53.36Z" />
  ),
  video: (
    <>
      <rect x={2} y={6} width={14} height={12} rx={2} />
      <path d="m22 8-6 4 6 4V8Z" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" />
      <circle cx={12} cy={10} r={3} />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  leaf: (
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </>
  ),
  calendar: (
    <>
      <rect x={3} y={4} width={18} height={18} rx={2} />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  globe: (
    <>
      <circle cx={12} cy={12} r={10} />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20" />
    </>
  ),
  sparkle: <path d="M12 3c.5 4.5 2 6 6.5 6.5C14 10 12.5 11.5 12 16c-.5-4.5-2-6-6.5-6.5C10 9 11.5 7.5 12 3Z" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  sun: (
    <>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  anchor: (
    <>
      <circle cx={12} cy={5} r={3} />
      <path d="M12 22V8" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </>
  ),
  clock: (
    <>
      <circle cx={12} cy={12} r={10} />
      <path d="M12 6v6l4 2" />
    </>
  ),
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />,
  smile: (
    <>
      <circle cx={12} cy={12} r={10} />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </>
  ),
  target: (
    <>
      <circle cx={12} cy={12} r={10} />
      <circle cx={12} cy={12} r={6} />
      <circle cx={12} cy={12} r={2} />
    </>
  ),
  wind: (
    <>
      <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
      <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
      <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
    </>
  ),
  home: (
    <>
      <path d="M3 9.5 12 2l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  feather: (
    <>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <path d="M16 8 2 22" />
      <path d="M17.5 15H9" />
    </>
  ),
  mountain: <path d="m8 3 4 8 5-5 5 15H2L8 3z" />,
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  headphones: (
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  ),
  coffee: (
    <>
      <path d="M10 2v2M14 2v2M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    </>
  ),
};

// GLYPH_NAMES is the full set the CMS offers as an icon picker (every icon the
// renderer can draw), so existing sites get new icons without a schema rewrite.
export const GLYPH_NAMES = Object.keys(ICONS);

export function hasGlyph(name: string): boolean {
  return name in ICONS;
}

export function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const el = ICONS[name];
  if (!el) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {el}
    </svg>
  );
}
