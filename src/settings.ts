export type PresetName =
  | "xbox"
  | "playstation"
  | "steam"
  | "nintendo"
  | "gold"
  | "midnight"
  | "sky-day"
  | "sky-night"
  | "pixel-day"
  | "pixel-night"
  | "pixel-sakura"
  | "custom";

export const ICON_SHAPES = ["circle", "rounded", "square"] as const;
export const BANNER_STYLES = ["gradient", "solid", "glass"] as const;
export const DECORATIONS = ["none", "sparkles", "sky-day", "sky-night", "pixel-day", "pixel-night", "pixel-sakura"] as const;
export const ENTRANCE_STYLES = ["pop", "slide", "fade", "bounce", "unfold", "drop", "flip", "retro"] as const;

export type IconShape = (typeof ICON_SHAPES)[number];
export type BannerStyle = (typeof BANNER_STYLES)[number];
export type Decoration = (typeof DECORATIONS)[number];
export type EntranceStyle = (typeof ENTRANCE_STYLES)[number];

export interface ThemeSettings {
  preset: PresetName;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  descColor: string;
  glowEnabled: boolean;
  glowIntensity: number;
  borderRadius: number;
  duration: number;
  iconBorder: boolean;
  iconShape: IconShape;
  bannerStyle: BannerStyle;
  rarityEffects: boolean;
  popupAnimation: boolean;
  decorativeElements: Decoration;
  entranceStyle: EntranceStyle;
  shineEnabled: boolean;
  /** Full animations even when Steam's Reduce Motion is on. A preference, so presets never set it. */
  ignoreReducedMotion: boolean;
}

type PresetValues = Omit<ThemeSettings, "preset" | "ignoreReducedMotion">;

const BASE: PresetValues = {
  primaryColor: "#107C10",
  secondaryColor: "#0e6b0e",
  accentColor: "#52b043",
  textColor: "#ffffff",
  descColor: "#a0d9a0",
  glowEnabled: true,
  glowIntensity: 20,
  borderRadius: 12,
  duration: 6000,
  iconBorder: true,
  iconShape: "circle",
  bannerStyle: "gradient",
  rarityEffects: true,
  popupAnimation: true,
  decorativeElements: "none",
  entranceStyle: "unfold",
  shineEnabled: true,
};

const SKY_DAY: PresetValues = {
  ...BASE,
  primaryColor: "#5EA6D6",
  secondaryColor: "#3D7EAE",
  accentColor: "#ECCA2F",
  textColor: "#FFF8E7",
  descColor: "#FFF8E7",
  glowIntensity: 15,
  borderRadius: 14,
  decorativeElements: "sky-day",
  entranceStyle: "drop",
};

const SKY_NIGHT: PresetValues = {
  ...BASE,
  primaryColor: "#2A2D3E",
  secondaryColor: "#1D1F2C",
  accentColor: "#C4C9D1",
  textColor: "#E8EBF2",
  descColor: "#E8EBF2",
  glowIntensity: 15,
  borderRadius: 14,
  decorativeElements: "sky-night",
  entranceStyle: "fade",
};

// Keep in sync with DEFAULT_SETTINGS in main.py (the xbox preset plus user preferences).
export const PRESETS: Record<Exclude<PresetName, "custom">, PresetValues> = {
  xbox: BASE,
  playstation: {
    ...BASE,
    primaryColor: "#003087",
    secondaryColor: "#00246B",
    accentColor: "#0070D1",
    descColor: "#87CEEB",
    borderRadius: 8,
    entranceStyle: "drop",
  },
  steam: {
    ...BASE,
    primaryColor: "#1b2838",
    secondaryColor: "#0e1620",
    accentColor: "#66c0f4",
    textColor: "#c7d5e0",
    descColor: "#8f98a0",
    glowEnabled: false,
    glowIntensity: 10,
    borderRadius: 4,
    duration: 5000,
    iconBorder: false,
    iconShape: "rounded",
    bannerStyle: "solid",
    entranceStyle: "slide",
  },
  nintendo: {
    ...BASE,
    primaryColor: "#e60012",
    secondaryColor: "#c20010",
    accentColor: "#ff4d4d",
    descColor: "#ffcccc",
    glowIntensity: 15,
    borderRadius: 16,
    entranceStyle: "fade",
  },
  gold: {
    ...BASE,
    primaryColor: "#44330a",
    secondaryColor: "#2a1f06",
    accentColor: "#ffd700",
    textColor: "#ffd700",
    descColor: "#daa520",
    glowIntensity: 25,
    borderRadius: 10,
    duration: 7000,
    entranceStyle: "pop",
  },
  midnight: {
    ...BASE,
    primaryColor: "#0d0221",
    secondaryColor: "#0a0118",
    accentColor: "#cc00ff",
    textColor: "#e0b0ff",
    descColor: "#9966cc",
    glowIntensity: 30,
    borderRadius: 14,
    entranceStyle: "bounce",
  },
  "sky-day": SKY_DAY,
  "sky-night": SKY_NIGHT,
  // The pixel skies are four bands from Secondary (top) to Primary (bottom), so these are the band ends.
  "pixel-day": {
    ...SKY_DAY,
    primaryColor: "#84c1ef",
    secondaryColor: "#3b86d1",
    borderRadius: 4,
    decorativeElements: "pixel-day",
    entranceStyle: "retro",
  },
  "pixel-night": {
    ...SKY_NIGHT,
    primaryColor: "#28306b",
    secondaryColor: "#0f1030",
    borderRadius: 4,
    decorativeElements: "pixel-night",
    entranceStyle: "retro",
  },
  "pixel-sakura": {
    ...BASE,
    primaryColor: "#fff3f7",
    secondaryColor: "#ffd6e4",
    accentColor: "#e0457b",
    textColor: "#5c1a3e",
    descColor: "#7d2f58",
    glowIntensity: 15,
    borderRadius: 4,
    decorativeElements: "pixel-sakura",
    entranceStyle: "retro",
  },
};

export const DEFAULT_SETTINGS: ThemeSettings = { preset: "xbox", ignoreReducedMotion: false, ...PRESETS.xbox };

export const PRESET_OPTIONS = [
  { data: "xbox", label: "Xbox" },
  { data: "playstation", label: "PlayStation" },
  { data: "steam", label: "Steam" },
  { data: "nintendo", label: "Nintendo" },
  { data: "gold", label: "Gold" },
  { data: "midnight", label: "Midnight" },
  { data: "sky-day", label: "Sky Day" },
  { data: "sky-night", label: "Sky Night" },
  { data: "pixel-day", label: "Pixel Day" },
  { data: "pixel-night", label: "Pixel Night" },
  { data: "pixel-sakura", label: "Cherry Blossom" },
  { data: "custom", label: "Custom" },
];

export const ICON_SHAPE_OPTIONS = [
  { data: "circle", label: "Circle" },
  { data: "rounded", label: "Rounded" },
  { data: "square", label: "Square" },
];

export const BANNER_STYLE_OPTIONS = [
  { data: "gradient", label: "Gradient" },
  { data: "solid", label: "Solid" },
  { data: "glass", label: "Glass (Blur)" },
];

export const TOAST_SHAPE_OPTIONS = [
  { data: 0, label: "Square" },
  { data: 8, label: "Rounded" },
  { data: 16, label: "Very Rounded" },
  { data: 24, label: "Pill" },
];

export const ENTRANCE_OPTIONS = [
  { data: "unfold", label: "Unfold (Xbox)" },
  { data: "drop", label: "Drop (PlayStation)" },
  { data: "slide", label: "Slide In" },
  { data: "pop", label: "Pop" },
  { data: "bounce", label: "Bounce" },
  { data: "fade", label: "Fade" },
  { data: "flip", label: "Flip" },
  { data: "retro", label: "Retro (16-bit)" },
];

export const DECORATION_OPTIONS = [
  { data: "none", label: "None" },
  { data: "sparkles", label: "Sparkles" },
  { data: "sky-day", label: "Sky Day" },
  { data: "sky-night", label: "Sky Night" },
  { data: "pixel-day", label: "Pixel Day (16-bit)" },
  { data: "pixel-night", label: "Pixel Night (16-bit)" },
  { data: "pixel-sakura", label: "Cherry Blossom (16-bit)" },
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) return fallback;
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return value.toLowerCase();
}

export function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function safeChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && (choices as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function safeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

const PRESET_NAMES = [...Object.keys(PRESETS), "custom"] as PresetName[];

// Persisted settings are untrusted: every field is validated before it can
// reach a CSS string.
export function sanitizeSettings(raw: Partial<Record<keyof ThemeSettings, unknown>> | null | undefined): ThemeSettings {
  const r = raw ?? {};
  const d = DEFAULT_SETTINGS;
  return {
    preset: safeChoice(r.preset, PRESET_NAMES, "custom"),
    primaryColor: safeColor(r.primaryColor, d.primaryColor),
    secondaryColor: safeColor(r.secondaryColor, d.secondaryColor),
    accentColor: safeColor(r.accentColor, d.accentColor),
    textColor: safeColor(r.textColor, d.textColor),
    descColor: safeColor(r.descColor, d.descColor),
    glowEnabled: safeBool(r.glowEnabled, d.glowEnabled),
    glowIntensity: clampNum(r.glowIntensity, 0, 50, d.glowIntensity),
    borderRadius: clampNum(r.borderRadius, 0, 32, d.borderRadius),
    duration: clampNum(r.duration, 1000, 30000, d.duration),
    iconBorder: safeBool(r.iconBorder, d.iconBorder),
    iconShape: safeChoice(r.iconShape, ICON_SHAPES, d.iconShape),
    bannerStyle: safeChoice(r.bannerStyle, BANNER_STYLES, d.bannerStyle),
    rarityEffects: safeBool(r.rarityEffects, d.rarityEffects),
    popupAnimation: safeBool(r.popupAnimation, d.popupAnimation),
    decorativeElements: safeChoice(r.decorativeElements, DECORATIONS, d.decorativeElements),
    entranceStyle: safeChoice(r.entranceStyle, ENTRANCE_STYLES, d.entranceStyle),
    shineEnabled: safeBool(r.shineEnabled, d.shineEnabled),
    ignoreReducedMotion: safeBool(r.ignoreReducedMotion, d.ignoreReducedMotion),
  };
}

// "#rrggbb" -> "r g b", for rgb(var(--x) / alpha) in generated CSS.
export function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// "#rrggbb" -> whole degrees and percents, the color picker's starting point.
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Decky's ColorPickerModal confirms with `hsla(H, S%, L%, A)`, and its sliders can hold decimals.
const HSL_RE = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[\d.]+%?\s*)?\)$/i;

/** "hsl(...)" or "hsla(...)" (alpha ignored) -> lowercase "#rrggbb", or null when unparseable. */
export function hslToHex(value: string): string | null {
  const m = HSL_RE.exec(value.trim());
  if (!m) return null;
  const hue = parseFloat(m[1]);
  const sat = parseFloat(m[2]);
  const lig = parseFloat(m[3]);
  if (![hue, sat, lig].every(Number.isFinite)) return null;
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, sat)) / 100;
  const l = Math.min(100, Math.max(0, lig)) / 100;
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** WCAG relative luminance of "#rrggbb": 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const linear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
}

/** Relative luminance above 0.55: text laid over this color has to be dark. */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.55;
}

let current: ThemeSettings = DEFAULT_SETTINGS;

export function getCurrentSettings(): ThemeSettings {
  return current;
}

export function setCurrentSettings(next: ThemeSettings): void {
  current = next;
}
