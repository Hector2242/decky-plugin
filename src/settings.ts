/**
 * @fileoverview Theme settings: presets, validation of persisted values and
 * the settings the live toast renders with.
 */

const PRESET_NAMES = [
  'xbox',
  'playstation',
  'steam',
  'nintendo',
  'gold',
  'midnight',
  'sky-day',
  'sky-night',
  'pixel-day',
  'pixel-night',
  'pixel-sakura',
  'pixel-halloween',
  'custom',
] as const;
const ICON_SHAPES = ['circle', 'rounded', 'square'] as const;
const BANNER_STYLES = ['gradient', 'solid', 'glass'] as const;
// Each id needs a Theme registered in decorations/index.tsx.
const DECORATIONS = [
  'none',
  'sparkles',
  'sky-day',
  'sky-night',
  'pixel-day',
  'pixel-night',
  'pixel-sakura',
  'pixel-halloween',
] as const;
const ENTRANCE_STYLES = [
  'pop',
  'slide',
  'fade',
  'bounce',
  'unfold',
  'drop',
  'flip',
  'retro',
] as const;

/** A built-in look, or `custom` once the user edits any value. */
export type PresetName = (typeof PRESET_NAMES)[number];
/** Shape of the achievement icon. */
export type IconShape = (typeof ICON_SHAPES)[number];
/** How the card background is painted. */
export type BannerStyle = (typeof BANNER_STYLES)[number];
/** Animated scene drawn behind the toast text. */
export type Decoration = (typeof DECORATIONS)[number];
/** Entrance animation, each with its matching exit. */
export type EntranceStyle = (typeof ENTRANCE_STYLES)[number];

/** Everything a preset sets: the look of the toast. */
interface PresetValues {
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

/** Settings persisted by main.py; the keys must match its DEFAULT_SETTINGS. */
export interface ThemeSettings extends PresetValues {
  preset: PresetName;
  /**
   * Full animations even when Steam's Reduce Motion is on. A preference, so
   * presets never set it.
   */
  ignoreReducedMotion: boolean;
}

/** Settings as read from disk: any key may be missing or hold anything. */
type UntrustedSettings = Partial<Record<keyof ThemeSettings, unknown>>;

const BASE: PresetValues = {
  primaryColor: '#107C10',
  secondaryColor: '#0e6b0e',
  accentColor: '#52b043',
  textColor: '#ffffff',
  descColor: '#a0d9a0',
  glowEnabled: true,
  glowIntensity: 20,
  borderRadius: 12,
  duration: 6000,
  iconBorder: true,
  iconShape: 'circle',
  bannerStyle: 'gradient',
  rarityEffects: true,
  popupAnimation: true,
  decorativeElements: 'none',
  entranceStyle: 'unfold',
  shineEnabled: true,
};

const SKY_DAY: PresetValues = {
  ...BASE,
  primaryColor: '#5EA6D6',
  secondaryColor: '#3D7EAE',
  accentColor: '#ECCA2F',
  textColor: '#FFF8E7',
  descColor: '#FFF8E7',
  glowIntensity: 15,
  borderRadius: 14,
  decorativeElements: 'sky-day',
  entranceStyle: 'drop',
};

const SKY_NIGHT: PresetValues = {
  ...BASE,
  primaryColor: '#2A2D3E',
  secondaryColor: '#1D1F2C',
  accentColor: '#C4C9D1',
  textColor: '#E8EBF2',
  descColor: '#E8EBF2',
  glowIntensity: 15,
  borderRadius: 14,
  decorativeElements: 'sky-night',
  entranceStyle: 'fade',
};

/** The values each built-in preset applies. */
export const PRESETS: Record<Exclude<PresetName, 'custom'>, PresetValues> = {
  'xbox': BASE,
  'playstation': {
    ...BASE,
    primaryColor: '#003087',
    secondaryColor: '#00246B',
    accentColor: '#0070D1',
    descColor: '#87CEEB',
    borderRadius: 8,
    entranceStyle: 'drop',
  },
  'steam': {
    ...BASE,
    primaryColor: '#1b2838',
    secondaryColor: '#0e1620',
    accentColor: '#66c0f4',
    textColor: '#c7d5e0',
    descColor: '#8f98a0',
    glowEnabled: false,
    glowIntensity: 10,
    borderRadius: 4,
    duration: 5000,
    iconBorder: false,
    iconShape: 'rounded',
    bannerStyle: 'solid',
    entranceStyle: 'slide',
  },
  'nintendo': {
    ...BASE,
    primaryColor: '#e60012',
    secondaryColor: '#c20010',
    accentColor: '#ff4d4d',
    descColor: '#ffcccc',
    glowIntensity: 15,
    borderRadius: 16,
    entranceStyle: 'fade',
  },
  'gold': {
    ...BASE,
    primaryColor: '#44330a',
    secondaryColor: '#2a1f06',
    accentColor: '#ffd700',
    textColor: '#ffd700',
    descColor: '#daa520',
    glowIntensity: 25,
    borderRadius: 10,
    duration: 7000,
    entranceStyle: 'pop',
  },
  'midnight': {
    ...BASE,
    primaryColor: '#0d0221',
    secondaryColor: '#0a0118',
    accentColor: '#cc00ff',
    textColor: '#e0b0ff',
    descColor: '#9966cc',
    glowIntensity: 30,
    borderRadius: 14,
    entranceStyle: 'bounce',
  },
  'sky-day': SKY_DAY,
  'sky-night': SKY_NIGHT,
  // The pixel skies are four bands from Secondary (top) to Primary (bottom),
  // so these are the band ends.
  'pixel-day': {
    ...SKY_DAY,
    primaryColor: '#84c1ef',
    secondaryColor: '#3b86d1',
    borderRadius: 4,
    decorativeElements: 'pixel-day',
    entranceStyle: 'retro',
  },
  'pixel-night': {
    ...SKY_NIGHT,
    primaryColor: '#28306b',
    secondaryColor: '#0f1030',
    borderRadius: 4,
    decorativeElements: 'pixel-night',
    entranceStyle: 'retro',
  },
  'pixel-sakura': {
    ...BASE,
    primaryColor: '#fff3f7',
    secondaryColor: '#ffd6e4',
    accentColor: '#e0457b',
    textColor: '#5c1a3e',
    descColor: '#7d2f58',
    glowIntensity: 15,
    borderRadius: 4,
    decorativeElements: 'pixel-sakura',
    entranceStyle: 'retro',
  },
  // The graveyard sky is a vignette: Primary around the moon, Secondary toward
  // the edges.
  'pixel-halloween': {
    ...BASE,
    primaryColor: '#2E2A55',
    secondaryColor: '#15121F',
    accentColor: '#B8A5E6',
    textColor: '#F4F2FF',
    descColor: '#C9C4DD',
    glowIntensity: 18,
    borderRadius: 4,
    decorativeElements: 'pixel-halloween',
    entranceStyle: 'retro',
  },
};

/**
 * The xbox preset plus user preferences. Keep in sync with DEFAULT_SETTINGS in
 * main.py.
 */
export const DEFAULT_SETTINGS: ThemeSettings = {
  preset: 'xbox',
  ignoreReducedMotion: false,
  ...PRESETS.xbox,
};

/** Preset dropdown entries, in menu order. */
export const PRESET_OPTIONS = [
  {data: 'xbox', label: 'Xbox'},
  {data: 'playstation', label: 'PlayStation'},
  {data: 'steam', label: 'Steam'},
  {data: 'nintendo', label: 'Nintendo'},
  {data: 'gold', label: 'Gold'},
  {data: 'midnight', label: 'Midnight'},
  {data: 'sky-day', label: 'Sky Day'},
  {data: 'sky-night', label: 'Sky Night'},
  {data: 'pixel-day', label: 'Pixel Day'},
  {data: 'pixel-night', label: 'Pixel Night'},
  {data: 'pixel-sakura', label: 'Cherry Blossom'},
  {data: 'pixel-halloween', label: 'Halloween'},
  {data: 'custom', label: 'Custom'},
];

/** Icon shape dropdown entries. */
export const ICON_SHAPE_OPTIONS = [
  {data: 'circle', label: 'Circle'},
  {data: 'rounded', label: 'Rounded'},
  {data: 'square', label: 'Square'},
];

/** Banner style dropdown entries. */
export const BANNER_STYLE_OPTIONS = [
  {data: 'gradient', label: 'Gradient'},
  {data: 'solid', label: 'Solid'},
  {data: 'glass', label: 'Glass (Blur)'},
];

/** Toast corner radius choices, in px. */
export const TOAST_SHAPE_OPTIONS = [
  {data: 0, label: 'Square'},
  {data: 8, label: 'Rounded'},
  {data: 16, label: 'Very Rounded'},
  {data: 24, label: 'Pill'},
];

/** Entrance style dropdown entries. */
export const ENTRANCE_OPTIONS = [
  {data: 'unfold', label: 'Unfold (Xbox)'},
  {data: 'drop', label: 'Drop (PlayStation)'},
  {data: 'slide', label: 'Slide In'},
  {data: 'pop', label: 'Pop'},
  {data: 'bounce', label: 'Bounce'},
  {data: 'fade', label: 'Fade'},
  {data: 'flip', label: 'Flip'},
  {data: 'retro', label: 'Retro (16-bit)'},
];

/** Decoration dropdown entries. */
export const DECORATION_OPTIONS = [
  {data: 'none', label: 'None'},
  {data: 'sparkles', label: 'Sparkles'},
  {data: 'sky-day', label: 'Sky Day'},
  {data: 'sky-night', label: 'Sky Night'},
  {data: 'pixel-day', label: 'Pixel Day (16-bit)'},
  {data: 'pixel-night', label: 'Pixel Night (16-bit)'},
  {data: 'pixel-sakura', label: 'Cherry Blossom (16-bit)'},
  {data: 'pixel-halloween', label: 'Halloween (16-bit)'},
];

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RRGGBB_PATTERN = /^#[0-9a-fA-F]{6}$/;
// Decky's ColorPickerModal confirms with `hsla(H, S%, L%, A)`, and its sliders
// can hold decimals.
const HSL_PATTERN =
  /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[\d.]+%?\s*)?\)$/i;

function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    return fallback;
  }
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return value.toLowerCase();
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function safeChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.find((choice) => choice === value) ?? fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Validates persisted settings field by field, since every value can end up in
 * a CSS string.
 */
export function sanitizeSettings(
  raw: UntrustedSettings | null | undefined,
): ThemeSettings {
  const input = raw ?? {};
  const defaults = DEFAULT_SETTINGS;
  return {
    preset: safeChoice(input.preset, PRESET_NAMES, 'custom'),
    primaryColor: safeColor(input.primaryColor, defaults.primaryColor),
    secondaryColor: safeColor(input.secondaryColor, defaults.secondaryColor),
    accentColor: safeColor(input.accentColor, defaults.accentColor),
    textColor: safeColor(input.textColor, defaults.textColor),
    descColor: safeColor(input.descColor, defaults.descColor),
    glowEnabled: safeBoolean(input.glowEnabled, defaults.glowEnabled),
    glowIntensity: clampNumber(
      input.glowIntensity,
      0,
      50,
      defaults.glowIntensity,
    ),
    borderRadius: clampNumber(input.borderRadius, 0, 32, defaults.borderRadius),
    duration: clampNumber(input.duration, 1000, 30000, defaults.duration),
    iconBorder: safeBoolean(input.iconBorder, defaults.iconBorder),
    iconShape: safeChoice(input.iconShape, ICON_SHAPES, defaults.iconShape),
    bannerStyle: safeChoice(
      input.bannerStyle,
      BANNER_STYLES,
      defaults.bannerStyle,
    ),
    rarityEffects: safeBoolean(input.rarityEffects, defaults.rarityEffects),
    popupAnimation: safeBoolean(input.popupAnimation, defaults.popupAnimation),
    decorativeElements: safeChoice(
      input.decorativeElements,
      DECORATIONS,
      defaults.decorativeElements,
    ),
    entranceStyle: safeChoice(
      input.entranceStyle,
      ENTRANCE_STYLES,
      defaults.entranceStyle,
    ),
    shineEnabled: safeBoolean(input.shineEnabled, defaults.shineEnabled),
    ignoreReducedMotion: safeBoolean(
      input.ignoreReducedMotion,
      defaults.ignoreReducedMotion,
    ),
  };
}

/** Red, green and blue (0-255) of a "#rrggbb" color; anything else is black. */
function rgbChannels(hex: string): [number, number, number] {
  if (!RRGGBB_PATTERN.test(hex)) return [0, 0, 0];
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Converts "#rrggbb" to "r g b", for `rgb(var(--x) / alpha)` in CSS. */
export function hexToRgbTriplet(hex: string): string {
  return rgbChannels(hex).join(' ');
}

/**
 * Converts "#rrggbb" to whole degrees and percents, the color picker's
 * starting point.
 */
export function hexToHsl(hex: string): {h: number; s: number; l: number} {
  const [red, green, blue] = rgbChannels(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) {
      hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    } else if (max === green) {
      hue = ((blue - red) / delta + 2) / 6;
    } else {
      hue = ((red - green) / delta + 4) / 6;
    }
  }
  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

/**
 * Converts "hsl(...)" or "hsla(...)" (alpha ignored) to lowercase "#rrggbb",
 * or returns null when the value does not parse.
 */
export function hslToHex(value: string): string | null {
  const match = HSL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [hue, saturation, lightness] = match
    .slice(1, 4)
    .map((group) => Number(group));
  if (![hue, saturation, lightness].every((part) => Number.isFinite(part))) {
    return null;
  }
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, saturation)) / 100;
  const l = Math.min(100, Math.max(0, lightness)) / 100;
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c =
      l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Returns the WCAG relative luminance of "#rrggbb": 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = rgbChannels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Whether text laid over this color has to be dark (luminance above 0.55). */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.55;
}

let currentSettings: ThemeSettings = DEFAULT_SETTINGS;

/** Returns the sanitized settings the live toast renders with. */
export function getCurrentSettings(): ThemeSettings {
  return currentSettings;
}

/** Replaces the settings the live toast renders with; pass sanitized values. */
export function setCurrentSettings(next: ThemeSettings): void {
  currentSettings = next;
}
