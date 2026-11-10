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
  'pixel-hoth',
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
  'pixel-hoth',
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
const TROPHY_REVEALS = [
  'off',
  'trophy',
  'spin',
  'pixels',
  'bullets',
  'blood',
] as const;
const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
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
/**
 * How the achievement icon turns into its tier trophy; `trophy` shows the
 * trophy alone.
 */
export type TrophyReveal = (typeof TROPHY_REVEALS)[number];
/** Where on screen Steam's toast window sits, as "vertical-horizontal". */
export type ToastPosition = (typeof POSITIONS)[number];

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
  iconBorder: boolean;
  iconShape: IconShape;
  bannerStyle: BannerStyle;
  popupAnimation: boolean;
  decorativeElements: Decoration;
  entranceStyle: EntranceStyle;
  shineEnabled: boolean;
}

/** A part of the card that Achievement Creation places. */
export type LayoutPart = 'icon' | 'badge' | 'label' | 'title' | 'desc';

/** Parts in paint order, so later ones take taps over earlier ones. */
export const LAYOUT_PARTS: readonly LayoutPart[] = [
  'desc',
  'title',
  'label',
  'icon',
  'badge',
];

/** Where one part sits, in px inside the card's border, and how big it is. */
export interface PartLayout {
  x: number;
  y: number;
  /** Icon and badge: width and height. Text: font size. */
  size: number;
  /** Only the badge, label and description can be hidden. */
  show: boolean;
}

/** The card as arranged in Achievement Creation. */
export interface ToastLayout extends Record<LayoutPart, PartLayout> {
  /** False keeps the standard layout. */
  custom: boolean;
  /** Card height in px, border included. */
  height: number;
}

/** The text above the title for each trophy tier; empty uses the built-in one. */
export interface TrophyLabels {
  none: string;
  bronze: string;
  silver: string;
  gold: string;
  platinum: string;
}

/**
 * Everything a preset sets: the theme plus Achievement Creation's parts.
 * Built-in presets use the standard parts.
 */
export interface PresetLook extends PresetValues {
  /** Achievement Creation's card layout. */
  layout: ToastLayout;
  /** Custom tier labels. */
  labels: TrophyLabels;
  /** Stored image that replaces each tier's trophy, or ''. */
  trophyImages: TrophyImages;
  /** Stored sound that replaces Steam's achievement sound, or ''. */
  customSound: string;
}

/** A trophy tier. */
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** The trophy tiers, lowest first. */
export const TROPHY_TIERS: readonly TrophyTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
];

/** A stored image per tier that replaces its trophy, or ''. */
export type TrophyImages = Record<TrophyTier, string>;

/** Id of a preset the user saved. */
export type UserPresetId = `user-${number}`;

/** A preset the user saved; built-in presets never change. */
export interface UserPreset extends PresetLook {
  id: UserPresetId;
  name: string;
}

/** Settings persisted by main.py; the keys must match its DEFAULT_SETTINGS. */
export interface ThemeSettings extends PresetLook {
  /** A built-in preset, one of the user's, or `custom` for an unsaved look. */
  preset: PresetName | UserPresetId;
  /** How long a toast stays on screen, in ms. A preference, so presets never set it. */
  duration: number;
  /** Where every Steam toast appears. A preference, so presets never set it. */
  position: ToastPosition;
  /**
   * Bronze, silver, gold and platinum trophy tiers, with every rarity effect.
   * A preference, so presets never set it.
   */
  rarityEffects: boolean;
  /** How the icon turns into its trophy. A preference, so presets never set it. */
  trophyReveal: TrophyReveal;
  /**
   * Full animations even when Steam's Reduce Motion is on. A preference, so
   * presets never set it.
   */
  ignoreReducedMotion: boolean;
  /**
   * Saves a picture of the screen, pop-up included, on every unlock. A
   * preference, so presets never set it.
   */
  screenshotOnUnlock: boolean;
  /** The user's own presets, in the order they were saved. */
  userPresets: UserPreset[];
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
  iconBorder: true,
  iconShape: 'circle',
  bannerStyle: 'gradient',
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
  // Hoth's sky runs from Secondary at the top to Primary above the snow.
  'pixel-hoth': {
    ...BASE,
    primaryColor: '#1F86E0',
    secondaryColor: '#06489B',
    accentColor: '#9FD6FF',
    textColor: '#FFFFFF',
    descColor: '#D6ECFF',
    glowIntensity: 15,
    borderRadius: 4,
    decorativeElements: 'pixel-hoth',
    entranceStyle: 'retro',
  },
};

/** Width of the live card in px; custom layouts are drawn at this width. */
export const CARD_WIDTH = 292;
/** The card's border width in px; layout positions start inside it. */
export const CARD_BORDER = 2;
const INNER_WIDTH = CARD_WIDTH - 2 * CARD_BORDER;
// Text keeps the card's 12px right padding and at least this much width.
const TEXT_PADDING = 12;
const MIN_TEXT_WIDTH = 24;

/**
 * Card heights a custom layout can use. Taller cards get cut by the toast
 * window's edge when Drop or Bounce travel, or in game at the bottom.
 */
export const HEIGHT_RANGE: [number, number] = [48, 88];

/** Size range of each part: px for the icon and badge, font px for text. */
export const SIZE_RANGE: Record<LayoutPart, [number, number]> = {
  icon: [24, 80],
  badge: [8, 32],
  label: [8, 20],
  title: [10, 28],
  desc: [8, 20],
};

/**
 * The standard layout as positions: what Achievement Creation starts from and
 * its Reset button returns to.
 */
export const DEFAULT_LAYOUT: ToastLayout = {
  custom: false,
  height: 84,
  icon: {x: 12, y: 16, size: 48, show: true},
  badge: {x: 72, y: 10, size: 12, show: true},
  label: {x: 90, y: 10, size: 10, show: true},
  title: {x: 72, y: 24, size: 14, show: true},
  desc: {x: 72, y: 44, size: 11, show: true},
};

/**
 * The xbox preset plus user preferences. Keep in sync with DEFAULT_SETTINGS in
 * main.py.
 */
export const DEFAULT_SETTINGS: ThemeSettings = {
  preset: 'xbox',
  duration: 6000,
  position: 'bottom-right',
  rarityEffects: true,
  trophyReveal: 'spin',
  ignoreReducedMotion: true,
  screenshotOnUnlock: false,
  ...builtInLook('xbox'),
  userPresets: [],
};

type BuiltInPreset = Exclude<PresetName, 'custom'>;

/** A built-in preset's look: its theme with the standard parts. */
function builtInLook(name: BuiltInPreset): PresetLook {
  return {
    ...PRESETS[name],
    layout: DEFAULT_LAYOUT,
    labels: {none: '', bronze: '', silver: '', gold: '', platinum: ''},
    trophyImages: {bronze: '', silver: '', gold: '', platinum: ''},
    customSound: '',
  };
}

/** Line height in px of a text part at a font size (description: per line). */
export function lineHeight(part: LayoutPart, size: number): number {
  return Math.round(size * (part === 'desc' ? 1.27 : 1.2));
}

/** A part's box in px inside the card's border. */
export interface PartBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a part of a custom layout is drawn. Text runs to the card's right
 * padding, or stops 8px short of an icon beside it on the right; the
 * description takes two lines.
 */
export function partBox(layout: ToastLayout, part: LayoutPart): PartBox {
  const {x, y, size} = layout[part];
  if (part === 'icon' || part === 'badge') {
    return {left: x, top: y, width: size, height: size};
  }
  const height = lineHeight(part, size) * (part === 'desc' ? 2 : 1);
  const icon = layout.icon;
  const iconBeside =
    icon.x > x && icon.y < y + height && icon.y + icon.size > y;
  const right = iconBeside ? icon.x - 8 : INNER_WIDTH - TEXT_PADDING;
  return {
    left: x,
    top: y,
    width: Math.max(MIN_TEXT_WIDTH, right - x),
    height,
  };
}

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
  {data: 'pixel-hoth', label: 'Hoth'},
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

/** A corner radius past half of any card's height: fully round ends. */
const PILL_RADIUS = 999;
// Pill used to be this radius, which only rounded the corners.
const OLD_PILL_RADIUS = 24;

/** Toast corner radius choices, in px. */
export const TOAST_SHAPE_OPTIONS = [
  {data: 0, label: 'Square'},
  {data: 8, label: 'Rounded'},
  {data: 16, label: 'Very Rounded'},
  {data: PILL_RADIUS, label: 'Pill'},
];

/** Entrance style dropdown entries. */
export const ENTRANCE_OPTIONS = [
  // Still keyed 'unfold', the old Xbox entrance, so saved settings keep it.
  {data: 'unfold', label: 'Xbox One'},
  {data: 'drop', label: 'Drop (PlayStation)'},
  {data: 'slide', label: 'Slide In'},
  {data: 'pop', label: 'Pop'},
  {data: 'bounce', label: 'Bounce'},
  {data: 'fade', label: 'Fade'},
  {data: 'flip', label: 'Flip'},
  {data: 'retro', label: 'Retro (16-bit)'},
];

/** Trophy reveal dropdown entries. */
export const REVEAL_OPTIONS = [
  {data: 'off', label: 'Off'},
  {data: 'trophy', label: 'Show trophy only'},
  {data: 'spin', label: 'Spin'},
  {data: 'pixels', label: 'Pixel Eater'},
  {data: 'bullets', label: 'Laser Blast'},
  {data: 'blood', label: 'Blood Drip'},
];

/** Toast position dropdown entries. */
export const POSITION_OPTIONS = [
  {data: 'top-left', label: 'Top Left'},
  {data: 'top-center', label: 'Top Middle'},
  {data: 'top-right', label: 'Top Right'},
  {data: 'bottom-left', label: 'Bottom Left'},
  {data: 'bottom-center', label: 'Bottom Middle'},
  {data: 'bottom-right', label: 'Bottom Right'},
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
  {data: 'pixel-hoth', label: 'Hoth (16-bit)'},
];

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RRGGBB_PATTERN = /^#[0-9a-fA-F]{6}$/;
// Decky's ColorPickerModal confirms with `hsla(H, S%, L%, A)`, and its sliders
// can hold decimals.
const HSL_PATTERN =
  /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[\d.]+%?\s*)?\)$/i;

// The fallback is normalized too (presets spell colors in upper case), so a
// second pass returns the same value.
function safeColor(value: unknown, fallback: string): string {
  const color =
    typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
      ? value
      : fallback;
  if (color.length === 4) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return color.toLowerCase();
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

function fieldsOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

// Whole pixels, even ones for positions: Steam's 1.5x UI scale puts an odd
// pixel on a half device pixel.
function evenPx(value: number): number {
  return Math.round(value / 2) * 2;
}

/** Clamps a layout's numbers and keeps every part inside the card. */
export function sanitizeLayout(raw: unknown): ToastLayout {
  const input = fieldsOf(raw);
  const height = evenPx(
    clampNumber(input.height, ...HEIGHT_RANGE, DEFAULT_LAYOUT.height),
  );
  const layout: ToastLayout = {
    ...DEFAULT_LAYOUT,
    custom: safeBoolean(input.custom, DEFAULT_LAYOUT.custom),
    height,
  };
  for (const part of LAYOUT_PARTS) {
    const value = fieldsOf(input[part]);
    const fallback = DEFAULT_LAYOUT[part];
    const size = clampNumber(value.size, ...SIZE_RANGE[part], fallback.size);
    layout[part] = {
      x: evenPx(clampNumber(value.x, 0, INNER_WIDTH, fallback.x)),
      y: evenPx(clampNumber(value.y, 0, height, fallback.y)),
      size:
        part === 'icon' || part === 'badge' ? evenPx(size) : Math.round(size),
      show:
        part === 'icon' ||
        part === 'title' ||
        safeBoolean(value.show, fallback.show),
    };
  }
  // Moved in only once every size is known: text width depends on the icon.
  for (const part of LAYOUT_PARTS) {
    const max = maxPosition(layout, part);
    layout[part].x = Math.min(layout[part].x, max.x);
    layout[part].y = Math.min(layout[part].y, max.y);
  }
  return layout;
}

/** The furthest right and down a part can sit and stay inside the card. */
export function maxPosition(
  layout: ToastLayout,
  part: LayoutPart,
): {x: number; y: number} {
  const box = partBox(layout, part);
  const x =
    part === 'icon' || part === 'badge'
      ? INNER_WIDTH - box.width
      : INNER_WIDTH - TEXT_PADDING - MIN_TEXT_WIDTH;
  const y = layout.height - 2 * CARD_BORDER - box.height;
  // Rounded down to even pixels, like positions themselves.
  const even = (value: number) => Math.max(0, Math.floor(value / 2) * 2);
  return {x: even(x), y: even(y)};
}

/** Longest custom label; the line shows about 30 characters. */
export const MAX_LABEL = 40;

function sanitizeLabels(raw: unknown): TrophyLabels {
  const input = fieldsOf(raw);
  const label = (value: unknown): string =>
    typeof value === 'string' ? value.slice(0, MAX_LABEL) : '';
  return {
    none: label(input.none),
    bronze: label(input.bronze),
    silver: label(input.silver),
    gold: label(input.gold),
    platinum: label(input.platinum),
  };
}

// main.py names stored files "<kind>-<milliseconds>[-<original name>].<ext>",
// keeping up to 32 safe characters of the name the file was picked under.
const ASSET_NAME =
  /^(trophy|sound)-\d{1,16}(-[A-Za-z0-9._ -]{1,32})?\.[a-z0-9]{2,4}$/;

/** The file name a stored image or sound was picked under, or ''. */
export function assetLabel(name: string): string {
  if (!name) return '';
  return /^(?:trophy|sound)-\d+-(.+)$/.exec(name)?.[1] ?? name;
}

function sanitizeTrophies(raw: unknown): TrophyImages {
  const input = fieldsOf(raw);
  return {
    bronze: safeAsset(input.bronze, 'trophy'),
    silver: safeAsset(input.silver, 'trophy'),
    gold: safeAsset(input.gold, 'trophy'),
    platinum: safeAsset(input.platinum, 'trophy'),
  };
}

function safeAsset(value: unknown, kind: 'trophy' | 'sound'): string {
  return typeof value === 'string' &&
    ASSET_NAME.test(value) &&
    value.startsWith(`${kind}-`)
    ? value
    : '';
}

/** The most presets a user can save. */
export const MAX_USER_PRESETS = 20;
/** Longest preset name. */
export const MAX_PRESET_NAME = 32;
const USER_PRESET_ID = /^user-\d{1,16}$/;

function sanitizeUserPresets(raw: unknown): UserPreset[] {
  if (!Array.isArray(raw)) return [];
  const presets: UserPreset[] = [];
  for (const item of raw) {
    const fields = fieldsOf(item);
    const {id, name} = fields;
    if (
      typeof id !== 'string' ||
      !USER_PRESET_ID.test(id) ||
      presets.some((saved) => saved.id === id)
    ) {
      continue;
    }
    presets.push({
      id: id as UserPresetId,
      name:
        typeof name === 'string' && name.trim()
          ? name.trim().slice(0, MAX_PRESET_NAME)
          : 'My preset',
      ...sanitizeLook(fields),
    });
    if (presets.length === MAX_USER_PRESETS) break;
  }
  return presets;
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
  const userPresets = sanitizeUserPresets(input.userPresets);
  const look = sanitizeLook(input);
  let preset: PresetName | UserPresetId = userPresets.some(
    (saved) => saved.id === input.preset,
  )
    ? (input.preset as UserPresetId)
    : safeChoice(input.preset, PRESET_NAMES, 'custom');
  // A built-in preset always shows its own look; anything else is Custom.
  if (
    isBuiltIn(preset) &&
    JSON.stringify(look) !== JSON.stringify(sanitizeLook(builtInLook(preset)))
  ) {
    preset = 'custom';
  }
  return {
    preset,
    ...look,
    // The panel's shortest choice; trophy reveals need about 2.2 s.
    duration: clampNumber(input.duration, 3000, 30000, defaults.duration),
    rarityEffects: safeBoolean(input.rarityEffects, defaults.rarityEffects),
    trophyReveal: safeChoice(
      input.trophyReveal,
      TROPHY_REVEALS,
      defaults.trophyReveal,
    ),
    position: safeChoice(input.position, POSITIONS, defaults.position),
    ignoreReducedMotion: safeBoolean(
      input.ignoreReducedMotion,
      defaults.ignoreReducedMotion,
    ),
    screenshotOnUnlock: safeBoolean(
      input.screenshotOnUnlock,
      defaults.screenshotOnUnlock,
    ),
    userPresets,
  };
}

function sanitizeLook(
  input: Partial<Record<keyof PresetLook, unknown>>,
): PresetLook {
  const defaults = DEFAULT_SETTINGS;
  return {
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
    borderRadius: clampNumber(
      input.borderRadius === OLD_PILL_RADIUS ? PILL_RADIUS : input.borderRadius,
      0,
      PILL_RADIUS,
      defaults.borderRadius,
    ),
    iconBorder: safeBoolean(input.iconBorder, defaults.iconBorder),
    iconShape: safeChoice(input.iconShape, ICON_SHAPES, defaults.iconShape),
    bannerStyle: safeChoice(
      input.bannerStyle,
      BANNER_STYLES,
      defaults.bannerStyle,
    ),
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
    layout: sanitizeLayout(input.layout),
    labels: sanitizeLabels(input.labels),
    trophyImages: sanitizeTrophies(input.trophyImages),
    customSound: safeAsset(input.customSound, 'sound'),
  };
}

function lookOf(source: PresetLook): PresetLook {
  return sanitizeLook(source);
}

function isBuiltIn(id: string): id is BuiltInPreset {
  return Object.prototype.hasOwnProperty.call(PRESETS, id);
}

/**
 * Applies a change the way presets work, returning sanitized settings.
 * Picking a preset loads its whole look. Any other change to the look saves
 * into the user's preset when one is picked; on a built-in preset, which never
 * changes, it turns the look into an unsaved Custom one.
 */
export function changeSettings(
  current: ThemeSettings,
  change: Partial<ThemeSettings>,
): ThemeSettings {
  const next = sanitizeSettings({...current, ...change});
  const picked = change.preset;
  if (picked !== undefined) {
    const saved = next.userPresets.find((user) => user.id === picked);
    if (saved) return {...next, preset: saved.id, ...lookOf(saved)};
    return isBuiltIn(picked)
      ? sanitizeSettings({...next, preset: picked, ...builtInLook(picked)})
      : next;
  }
  // An edited built-in look has already turned into Custom (sanitizeSettings).
  const index = next.userPresets.findIndex((user) => user.id === next.preset);
  if (
    index < 0 ||
    JSON.stringify(lookOf(next)) === JSON.stringify(lookOf(current))
  ) {
    return next;
  }
  const userPresets = [...next.userPresets];
  userPresets[index] = {...userPresets[index], ...lookOf(next)};
  return {...next, userPresets};
}

/** Saves the current look as a new preset of the user's and picks it. */
export function addUserPreset(
  current: ThemeSettings,
  name: string,
): ThemeSettings {
  if (current.userPresets.length >= MAX_USER_PRESETS) return current;
  let stamp = Date.now();
  while (current.userPresets.some((user) => user.id === `user-${stamp}`)) {
    stamp++;
  }
  const id: UserPresetId = `user-${stamp}`;
  return sanitizeSettings({
    ...current,
    preset: id,
    userPresets: [...current.userPresets, {id, name, ...lookOf(current)}],
  });
}

/** Renames one of the user's presets. */
export function renameUserPreset(
  current: ThemeSettings,
  id: UserPresetId,
  name: string,
): ThemeSettings {
  return sanitizeSettings({
    ...current,
    userPresets: current.userPresets.map((user) =>
      user.id === id ? {...user, name} : user,
    ),
  });
}

/**
 * Deletes one of the user's presets. If it was picked, the toast keeps its
 * look as Custom rather than changing under the user.
 */
export function deleteUserPreset(
  current: ThemeSettings,
  id: UserPresetId,
): ThemeSettings {
  return sanitizeSettings({
    ...current,
    preset: current.preset === id ? 'custom' : current.preset,
    userPresets: current.userPresets.filter((user) => user.id !== id),
  });
}

/** Preset dropdown entries: the built-in presets, the user's, then Custom. */
export function presetOptions(
  settings: ThemeSettings,
): Array<{data: string; label: string}> {
  return [
    ...PRESET_OPTIONS.filter((option) => option.data !== 'custom'),
    ...settings.userPresets.map((user) => ({data: user.id, label: user.name})),
    {data: 'custom', label: 'Custom'},
  ];
}

/** The picked preset's name as the dropdown shows it. */
export function presetName(settings: ThemeSettings): string {
  return (
    presetOptions(settings).find((option) => option.data === settings.preset)
      ?.label ?? 'Custom'
  );
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

/** Event main.py sends with the stored settings after every save. */
export const SETTINGS_CHANGED = 'settings_changed';

let currentSettings: ThemeSettings = DEFAULT_SETTINGS;

/** Returns the sanitized settings the live toast renders with. */
export function getCurrentSettings(): ThemeSettings {
  return currentSettings;
}

/** Replaces the settings the live toast renders with; pass sanitized values. */
export function setCurrentSettings(next: ThemeSettings): void {
  currentSettings = next;
}
