// Each decoration is a file exporting a Theme; add its id to DECORATIONS (settings.ts) and register it in THEMES.
import type { JSX } from "react";
import type { MotionParts } from "../motion";
import type { Decoration } from "../settings";
import { halloween } from "./halloween";
import { DITHER, PIXEL_BASE } from "./pixelArt";
import { pixelDay } from "./pixelDay";
import { pixelNight } from "./pixelNight";
import { sakura } from "./sakura";
import { skyDay, skyNight, sparkles } from "./smooth";

export interface Theme {
  /** Only the theme's own sprites; DecorationLayer supplies the wrapper. */
  Layer: () => JSX.Element;
  css: () => MotionParts;
  /** Card background for themes that paint their own scene. */
  background?: string;
  /**
   * 16-bit scene. Both kinds get the shared sprite rules and band variables; "banded" skies also get the
   * dither strips between the four bands, "custom" ones draw their own backdrop.
   */
  pixel?: "banded" | "custom";
}

const THEMES: Record<Decoration, Theme | null> = {
  none: null,
  sparkles,
  "sky-day": skyDay,
  "sky-night": skyNight,
  "pixel-day": pixelDay,
  "pixel-night": pixelNight,
  "pixel-sakura": sakura,
  "pixel-halloween": halloween,
};

/** Card background for decorations that paint their own scene, otherwise null. */
export function decorationBackground(d: Decoration): string | null {
  return THEMES[d]?.background ?? null;
}

export function hasDecorationBackground(d: Decoration): boolean {
  return decorationBackground(d) !== null;
}

export function DecorationLayer({ variant }: { variant: Decoration }) {
  const theme = THEMES[variant];
  if (!theme) return null;
  const { Layer, pixel } = theme;
  return (
    <div className={pixel ? "ac-decoration ac-px-decoration" : "ac-decoration"}>
      {pixel === "banded" && [1, 2, 3].map((i) => <span key={i} className={`ac-px-dither ac-px-d${i}`} />)}
      <Layer />
    </div>
  );
}

const NO_DECORATION: MotionParts = { always: "", full: "", reduced: "" };
// DecorationLayer wraps every theme in .ac-decoration, so this rule goes ahead of the theme's own CSS.
const DECORATION_BASE =
  ".ac-decoration { position: absolute; inset: 0; overflow: hidden; border-radius: calc(var(--ac-radius) - 2px); pointer-events: none; z-index: 0; }";

export function decorationCSS(d: Decoration): MotionParts {
  const theme = THEMES[d];
  if (!theme) return NO_DECORATION;
  const parts = theme.css();
  const base = [DECORATION_BASE, ...(theme.pixel ? [PIXEL_BASE] : []), ...(theme.pixel === "banded" ? [DITHER] : [])].join("\n");
  return { ...parts, always: `${base}\n${parts.always}` };
}
