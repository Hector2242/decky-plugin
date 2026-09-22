export type PresetName =
  | "xbox"
  | "playstation"
  | "steam"
  | "nintendo"
  | "gold"
  | "midnight"
  | "sky-day"
  | "sky-night"
  | "custom";

export const ICON_SHAPES = ["circle", "rounded", "square"] as const;
export const BANNER_STYLES = ["gradient", "solid", "glass"] as const;
export const DECORATIONS = ["none", "sparkles", "sky-day", "sky-night"] as const;
export const ENTRANCE_STYLES = ["pop", "slide", "fade", "bounce", "unfold", "drop"] as const;

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
}

type PresetValues = Omit<ThemeSettings, "preset">;

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

// Keep in sync with DEFAULT_SETTINGS in main.py (which mirrors the xbox preset).
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
  "sky-day": {
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
  },
  "sky-night": {
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
  },
};

export const DEFAULT_SETTINGS: ThemeSettings = { preset: "xbox", ...PRESETS.xbox };

export const PRESET_OPTIONS = [
  { data: "xbox", label: "Xbox" },
  { data: "playstation", label: "PlayStation" },
  { data: "steam", label: "Steam" },
  { data: "nintendo", label: "Nintendo" },
  { data: "gold", label: "Gold" },
  { data: "midnight", label: "Midnight" },
  { data: "sky-day", label: "Sky Day" },
  { data: "sky-night", label: "Sky Night" },
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
];

export const DECORATION_OPTIONS = [
  { data: "none", label: "None" },
  { data: "sparkles", label: "Sparkles" },
  { data: "sky-day", label: "Sky Day" },
  { data: "sky-night", label: "Sky Night" },
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
  };
}

// "#rrggbb" -> "r g b", for rgb(var(--x) / alpha) in generated CSS.
export function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

let current: ThemeSettings = DEFAULT_SETTINGS;

export function getCurrentSettings(): ThemeSettings {
  return current;
}

export function setCurrentSettings(next: ThemeSettings): void {
  current = next;
}
