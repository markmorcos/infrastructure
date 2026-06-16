import { argbFromHex, hexFromArgb, Hct } from "@material/material-color-utilities";

// Mirrors the practa renderer's theme derivation (practa src/lib/theme.ts) for a
// settings-panel preview: sage primary + the clay accent auto-derived by rotating
// the seed hue +230°. Tones match the renderer's ramps (sage-700 = 36, clay-500 =
// 56, sage-50 = 94) so the preview reflects what the live site will show.
export interface ThemePreview {
  primary: string;
  accent: string;
  surface: string;
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export function previewFromSeed(seed: string): ThemePreview | null {
  if (!HEX_RE.test(seed)) return null;
  const hex = seed.startsWith("#") ? seed : `#${seed}`;
  const hue = Hct.fromInt(argbFromHex(hex)).hue;
  const sage = (tone: number) => hexFromArgb(Hct.from(hue, 16, tone).toInt());
  const clay = (tone: number) => hexFromArgb(Hct.from((hue + 230) % 360, 36, tone).toInt());
  return { primary: sage(36), accent: clay(56), surface: sage(94) };
}
