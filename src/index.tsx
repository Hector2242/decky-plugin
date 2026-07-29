import {
  ButtonItem,
  ColorPickerModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
  achievementClasses,
  findClassModule,
  showModal,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
  injectCssIntoTab,
  removeCssFromTab,
  executeInTab,
} from "@decky/api";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaPalette } from "react-icons/fa";

const getSettings = callable<[], ThemeSettings>("get_settings");
const saveSettings = callable<[settings: ThemeSettings], boolean>("save_settings");
const getDefaultSettings = callable<[], ThemeSettings>("get_default_settings");
// TEMPORARY DIAGNOSTIC — see the AC-PROBE block below. Remove together with it.
const debugLog = callable<[message: string], boolean>("debug_log");

type PresetName = "xbox" | "playstation" | "steam" | "nintendo" | "gold" | "midnight" | "sky-day" | "sky-night" | "custom";
type IconShape = "circle" | "rounded" | "square";
type BannerStyle = "gradient" | "solid" | "glass";
type DecorativeElements = "none" | "sky-day" | "sky-night" | "sparkles";

interface ThemeSettings {
  preset: PresetName | string;
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
  iconShape: IconShape | string;
  bannerStyle: BannerStyle | string;
  rarityEffects: boolean;
  popupAnimation: boolean;
  decorativeElements: DecorativeElements | string;
  entranceStyle: EntranceStyle | string;
  shineEnabled: boolean;
}

interface RarityOverride {
  label: string;
  accentColor: string;
  extraCSS: string;
  titlePrefix: string;
  // Rare and above get the brighter, double-pass shine sweep.
  shineIntense: boolean;
}

interface MaybeAchievement {
  strName?: string;
  strDisplayName?: string;
  strDescription?: string;
  strDesc?: string;
  strImage?: string;
  strIcon?: string;
  flAchieved?: number;
}

interface AchievementNotification {
  achievement?: {
    vecHighlight?: MaybeAchievement[];
    vecAchievedHidden?: MaybeAchievement[];
    rgAchievements?: MaybeAchievement[];
  };
  vecHighlight?: MaybeAchievement[];
  vecAchievedHidden?: MaybeAchievement[];
}

interface RegisterHandle {
  unregister?: () => void;
}

interface SteamClientShape {
  GameSessions?: {
    RegisterForAchievementNotification?: (
      cb: (notification: AchievementNotification) => void,
    ) => RegisterHandle;
  };
}

function iconRadius(shape: string): string {
  if (shape === "rounded") return "8px";
  if (shape === "square") return "0px";
  return "50%";
}

type DecorationVariant = "sky-day" | "sky-night" | "sparkles";

// The decoration to render, or null for "none"/unknown. Persisted settings are
// untrusted, so every path funnels through this whitelist instead of comparing
// the raw string in five places.
function activeDecoration(s: ThemeSettings): DecorationVariant | null {
  const d = s.decorativeElements;
  return d === "sky-day" || d === "sky-night" || d === "sparkles" ? d : null;
}

// Sky variants paint their own sky gradient over the card; sparkles are an
// overlay only, so the user's banner colors keep showing through.
function decorationOwnsBackground(variant: DecorationVariant | null): boolean {
  return variant === "sky-day" || variant === "sky-night";
}

// Sparkle placement: position, size, timing offset. Deliberately avoids the
// left icon column and the right ~15% so sparkles read as framing the text
// rather than sitting on top of it.
const SPARKLES: { top: string; left: string; size: number; delay: number; duration: number }[] = [
  { top: "18%", left: "16%", size: 10, delay: 0,    duration: 2.4 },
  { top: "64%", left: "12%", size: 7,  delay: 0.9,  duration: 2.8 },
  { top: "34%", left: "27%", size: 6,  delay: 1.7,  duration: 2.2 },
  { top: "78%", left: "33%", size: 9,  delay: 0.45, duration: 3.0 },
  { top: "12%", left: "43%", size: 8,  delay: 1.3,  duration: 2.6 },
  { top: "70%", left: "51%", size: 6,  delay: 2.1,  duration: 2.4 },
  { top: "26%", left: "58%", size: 12, delay: 0.7,  duration: 3.2 },
  { top: "80%", left: "66%", size: 7,  delay: 1.55, duration: 2.5 },
  { top: "20%", left: "74%", size: 9,  delay: 2.35, duration: 2.9 },
  { top: "58%", left: "80%", size: 8,  delay: 1.05, duration: 2.7 },
];

// Four-point star via clip-path: concave points need a polygon, and a polygon
// costs nothing extra on the compositor since only opacity/scale/rotate animate.
const SPARKLE_CLIP_PATH =
  "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

function buildSparkleCSS(accent: string, scope: string): string {
  const sel = scope ? `${scope} .ac-sparkle` : ".ac-sparkle";
  const perSparkle = SPARKLES.map((sp, i) => {
    const one = scope ? `${scope} .ac-sparkle-${i + 1}` : `.ac-sparkle-${i + 1}`;
    return `${one} {
      top: ${sp.top}; left: ${sp.left};
      width: ${sp.size}px; height: ${sp.size}px;
      animation-delay: ${sp.delay}s;
      animation-duration: ${sp.duration}s;
    }`;
  }).join("\n");

  return `
    ${sel} {
      position: absolute;
      background: ${accent};
      clip-path: ${SPARKLE_CLIP_PATH};
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 0 6px ${accent}aa;
      will-change: opacity, scale, rotate;
      animation-name: ac-sparkle-pop;
      animation-iteration-count: infinite;
      animation-timing-function: ease-in-out;
    }
    ${perSparkle}
    @keyframes ac-sparkle-pop {
      0%, 100% { opacity: 0;    scale: 0.2; rotate: 0deg; }
      35%      { opacity: 1;    scale: 1;   rotate: 25deg; }
      65%      { opacity: 0.85; scale: 0.9; rotate: 35deg; }
    }
  `;
}

function sparkleDOMHTML(): string {
  return SPARKLES.map((_, i) => `<div class="ac-sparkle ac-sparkle-${i + 1}"></div>`).join("");
}

const ENTRANCE_STYLES = ["pop", "slide", "fade", "bounce"] as const;
type EntranceStyle = (typeof ENTRANCE_STYLES)[number];

function safeEntrance(value: string): EntranceStyle {
  return (ENTRANCE_STYLES as readonly string[]).includes(value)
    ? (value as EntranceStyle)
    : "pop";
}

// Entrance animation shared by the custom-toast, native-toast and preview paths.
// Keyframes only touch the standalone transform properties (scale/translate) plus
// opacity and border-radius — never the `transform` shorthand, which would
// replace the transform Steam uses to position the toast and shift where it
// rests. Keyframe names are per-style so two toasts with different settings on
// screen at once can't clobber each other's definition.
function entranceCSS(style: EntranceStyle, borderRadius: number): { keyframes: string; animation: string } {
  const name = `ac-enter-${style}`;

  if (style === "slide") {
    return {
      keyframes: `
        @keyframes ${name} {
          0%   { opacity: 0; translate: 44px 0; }
          70%  { opacity: 1; translate: -6px 0; }
          100% { opacity: 1; translate: 0 0; }
        }
      `,
      animation: `animation: ${name} 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;`,
    };
  }

  if (style === "fade") {
    return {
      keyframes: `
        @keyframes ${name} {
          0%   { opacity: 0; scale: 0.96; }
          100% { opacity: 1; scale: 1; }
        }
      `,
      animation: `animation: ${name} 0.45s ease-out forwards !important;`,
    };
  }

  if (style === "bounce") {
    return {
      keyframes: `
        @keyframes ${name} {
          0%   { opacity: 0; scale: 0.5; translate: 0 -18px; }
          40%  { opacity: 1; scale: 1.06; translate: 0 0; }
          58%  { scale: 0.95; translate: 0 -7px; }
          76%  { scale: 1.03; translate: 0 0; }
          88%  { scale: 0.99; translate: 0 -2px; }
          100% { opacity: 1; scale: 1; translate: 0 0; }
        }
      `,
      animation: `animation: ${name} 0.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards !important;`,
    };
  }

  return {
    keyframes: `
      @keyframes ${name} {
        0%   { opacity: 0; scale: 0.3; border-radius: 50%; }
        40%  { opacity: 1; scale: 1.05; border-radius: ${borderRadius * 2}px; }
        70%  { scale: 0.97; border-radius: ${borderRadius}px; }
        100% { opacity: 1; scale: 1; border-radius: ${borderRadius}px; }
      }
    `,
    animation: `animation: ${name} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;`,
  };
}

// One-shot diagonal light sweep across the card on arrival.
//
// Driven by background-position on an inset overlay rather than a translating
// child: the overlay inherits the card's border-radius and clips itself, so no
// overflow:hidden is needed (the card must keep overflow visible for its glow).
// `scope` prefixes the keyframe name so the plain and rarity-boosted variants
// can coexist in one stylesheet.
function buildShineCSS(selector: string, opts: { intense: boolean }): string {
  const name = opts.intense ? "ac-shine-strong" : "ac-shine";
  const peak = opts.intense ? 0.55 : 0.3;
  const runs = opts.intense ? 2 : 1;
  const duration = opts.intense ? "1.1s" : "0.9s";

  return `
    ${eachSelector(selector, "::after")} {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;
      background: linear-gradient(
        105deg,
        transparent 35%,
        rgba(255, 255, 255, ${peak}) 50%,
        transparent 65%
      );
      background-size: 300% 100%;
      background-repeat: no-repeat;
      animation: ${name} ${duration} ease-in-out ${runs} 0.25s both;
    }
    @keyframes ${name} {
      0%   { background-position: 150% 0; opacity: 0; }
      15%  { opacity: 1; }
      85%  { opacity: 1; }
      100% { background-position: -150% 0; opacity: 0; }
    }
  `;
}

// Persisted settings are untrusted input: validate colors and clamp numbers
// before interpolating anything into CSS strings.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeColor(value: string, fallback: string): string {
  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) return fallback;
  if (value.length === 4) {
    // Expand #rgb to #rrggbb so "aa"-suffix alpha tricks keep working.
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

function clampNum(value: number, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function sanitizeSettings(s: ThemeSettings): ThemeSettings {
  const d = PRESETS.xbox;
  return {
    ...s,
    primaryColor: safeColor(s.primaryColor, d.primaryColor),
    secondaryColor: safeColor(s.secondaryColor, d.secondaryColor),
    accentColor: safeColor(s.accentColor, d.accentColor),
    textColor: safeColor(s.textColor, d.textColor),
    descColor: safeColor(s.descColor, d.descColor),
    glowIntensity: clampNum(s.glowIntensity, 0, 60, d.glowIntensity),
    borderRadius: clampNum(s.borderRadius, 0, 32, d.borderRadius),
    duration: clampNum(s.duration, 1000, 30000, d.duration),
    entranceStyle: safeEntrance(s.entranceStyle as string),
  };
}

function bannerBgCSS(s: ThemeSettings): string {
  if (s.bannerStyle === "solid") return `background: ${s.primaryColor} !important;`;
  if (s.bannerStyle === "glass") {
    return `background: ${s.primaryColor}cc !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;`;
  }
  return `background: linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor}) !important;`;
}

function getRarityOverride(globalPct: number, enabled: boolean): RarityOverride | null {
  if (!enabled || globalPct < 0) return null;

  if (globalPct < 1) {
    return {
      label: "Ultra Rare",
      accentColor: "#E5E4E2",
      titlePrefix: "💎 Ultra Rare!",
      shineIntense: true,
      extraCSS: `
        .achievement-customizer-toast {
          border-color: #E5E4E2 !important;
          animation: ultra-rare-radiate 2s ease-in-out infinite !important;
        }
        @keyframes ultra-rare-radiate {
          0% { box-shadow: 0 0 15px #E5E4E288, 0 0 30px #00FFFF44, 0 0 50px #E5E4E222, inset 0 0 15px #E5E4E211; }
          33% { box-shadow: 0 0 25px #00FFFFaa, 0 0 50px #E5E4E266, 0 0 90px #00FFFF33, 0 0 130px #E5E4E211, inset 0 0 20px #00FFFF11; }
          66% { box-shadow: 0 0 30px #E5E4E2bb, 0 0 60px #00FFFF55, 0 0 100px #E5E4E233, 0 0 150px #00FFFF11, inset 0 0 25px #E5E4E211; }
          100% { box-shadow: 0 0 15px #E5E4E288, 0 0 30px #00FFFF44, 0 0 50px #E5E4E222, inset 0 0 15px #E5E4E211; }
        }
      `,
    };
  }

  if (globalPct < 10) {
    return {
      label: "Rare",
      accentColor: "#FFD700",
      titlePrefix: "⭐ Rare Achievement!",
      shineIntense: true,
      extraCSS: `
        .achievement-customizer-toast {
          border-color: #FFD700 !important;
          animation: rare-radiate 2.5s ease-in-out infinite !important;
        }
        @keyframes rare-radiate {
          0% { box-shadow: 0 0 15px #FFD70077, 0 0 30px #FFA50033, 0 0 50px #FFD70011, inset 0 0 10px #FFD70011; }
          50% { box-shadow: 0 0 30px #FFD700bb, 0 0 60px #FFA50066, 0 0 100px #FFD70033, 0 0 140px #FFA50011, inset 0 0 20px #FFD70022; }
          100% { box-shadow: 0 0 15px #FFD70077, 0 0 30px #FFA50033, 0 0 50px #FFD70011, inset 0 0 10px #FFD70011; }
        }
      `,
    };
  }

  if (globalPct < 25) {
    return {
      label: "Uncommon",
      accentColor: "",
      titlePrefix: "",
      shineIntense: false,
      extraCSS: `
        .achievement-customizer-toast {
          animation: uncommon-shimmer 3s ease-in-out infinite !important;
        }
        @keyframes uncommon-shimmer {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
          100% { filter: brightness(1); }
        }
      `,
    };
  }

  return null;
}

const PRESETS: Record<string, Omit<ThemeSettings, "preset">> = {
  xbox: {
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
    entranceStyle: "pop",
    shineEnabled: true,
  },
  playstation: {
    primaryColor: "#003087",
    secondaryColor: "#00246B",
    accentColor: "#0070D1",
    textColor: "#ffffff",
    descColor: "#87CEEB",
    glowEnabled: true,
    glowIntensity: 20,
    borderRadius: 8,
    duration: 6000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "none",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  steam: {
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
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "none",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  nintendo: {
    primaryColor: "#e60012",
    secondaryColor: "#c20010",
    accentColor: "#ff4d4d",
    textColor: "#ffffff",
    descColor: "#ffcccc",
    glowEnabled: true,
    glowIntensity: 15,
    borderRadius: 16,
    duration: 6000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "none",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  gold: {
    primaryColor: "#44330a",
    secondaryColor: "#2a1f06",
    accentColor: "#ffd700",
    textColor: "#ffd700",
    descColor: "#daa520",
    glowEnabled: true,
    glowIntensity: 25,
    borderRadius: 10,
    duration: 7000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "none",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  midnight: {
    primaryColor: "#0d0221",
    secondaryColor: "#0a0118",
    accentColor: "#cc00ff",
    textColor: "#e0b0ff",
    descColor: "#9966cc",
    glowEnabled: true,
    glowIntensity: 30,
    borderRadius: 14,
    duration: 6000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "none",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  "sky-day": {
    primaryColor: "#5EA6D6",
    secondaryColor: "#3D7EAE",
    accentColor: "#ECCA2F",
    textColor: "#FFF8E7",
    descColor: "#FFF8E7",
    glowEnabled: true,
    glowIntensity: 15,
    borderRadius: 14,
    duration: 6000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "sky-day",
    entranceStyle: "pop",
    shineEnabled: true,
  },
  "sky-night": {
    primaryColor: "#2A2D3E",
    secondaryColor: "#1D1F2C",
    accentColor: "#C4C9D1",
    textColor: "#E8EBF2",
    descColor: "#E8EBF2",
    glowEnabled: true,
    glowIntensity: 15,
    borderRadius: 14,
    duration: 6000,
    iconBorder: true,
    iconShape: "circle",
    bannerStyle: "gradient",
    rarityEffects: true,
    popupAnimation: true,
    decorativeElements: "sky-night",
    entranceStyle: "pop",
    shineEnabled: true,
  },
};

const PRESET_OPTIONS = [
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

const ICON_SHAPE_OPTIONS = [
  { data: "circle", label: "Circle" },
  { data: "rounded", label: "Rounded" },
  { data: "square", label: "Square" },
];

const BANNER_STYLE_OPTIONS = [
  { data: "gradient", label: "Gradient" },
  { data: "solid", label: "Solid" },
  { data: "glass", label: "Glass (Blur)" },
];

const TOAST_SHAPE_OPTIONS = [
  { data: 0, label: "Square" },
  { data: 8, label: "Rounded" },
  { data: 16, label: "Very Rounded" },
  { data: 24, label: "Pill" },
];

const ENTRANCE_OPTIONS = [
  { data: "pop", label: "Pop" },
  { data: "slide", label: "Slide In" },
  { data: "fade", label: "Fade" },
  { data: "bounce", label: "Bounce" },
];

const DECORATION_OPTIONS = [
  { data: "none", label: "None" },
  { data: "sparkles", label: "Sparkles" },
  { data: "sky-day", label: "Sky Day" },
  { data: "sky-night", label: "Sky Night" },
];

const CSS_CLASS_RE = /^[A-Za-z0-9_-]+$/;

// Joins runtime-resolved class names with a legacy hash fallback into one
// comma-separated selector list. Steam's hashed classes change across client
// updates; @decky/ui's class maps resolve the current names by semantic key.
function classSelectorList(names: (string | undefined)[], legacyHash?: string): string {
  const out: string[] = [];
  for (const n of names) {
    if (n && CSS_CLASS_RE.test(n)) out.push(`.${n}`);
  }
  if (legacyHash && !out.includes(`.${legacyHash}`)) out.push(`.${legacyHash}`);
  return [...new Set(out)].join(", ");
}

// First usable class from the candidates — for :has() combos where a full
// cross-product of fallback selectors would be unreadable.
function firstClassName(...names: (string | undefined)[]): string | null {
  for (const n of names) {
    if (n && CSS_CLASS_RE.test(n)) return n;
  }
  return null;
}

function buildAchievementPageCSS(raw: ThemeSettings): string {
  const s = sanitizeSettings(raw);
  const ir = iconRadius(s.iconShape);
  const glowRgba = `${s.accentColor}66`;
  const glowRgbaStrong = `${s.accentColor}99`;

  // achievementClasses resolves live class names from Steam's CSS modules;
  // the raw hashes are fallbacks for builds where the lookup fails.
  const row = classSelectorList([achievementClasses?.AchievementListItemBase], "_2Kmn7fJOkLT4KyWl467a9M");
  const imageContainer = classSelectorList([achievementClasses?.ImageContainer], "_1fEbX-PfpZ2FhkhttWcm-V");
  const unlockInfo = classSelectorList(
    [achievementClasses?.UnlockContainer, achievementClasses?.UnlockDate],
    "k02sevxj1a1YpBto7_V57",
  );
  const rowHover = row.split(", ").map((r) => `${r}:hover`).join(", ");

  const achievedRow = firstClassName(achievementClasses?.AchievementListItemBase, "_2Kmn7fJOkLT4KyWl467a9M");
  const achievedMarker = firstClassName(achievementClasses?.UnlockContainer, "k02sevxj1a1YpBto7_V57");
  const achievedGlowCSS = achievedRow && achievedMarker ? `
    .${achievedRow}:has(.${achievedMarker}) {
      animation: xbox-glow-pulse 3s ease-in-out infinite !important;
      ${bannerBgCSS(s)}
      border-color: ${s.accentColor} !important;
    }
  ` : "";

  return `
    ${row} {
      ${bannerBgCSS(s)}
      border: 1px solid ${s.accentColor}4d !important;
      border-radius: ${s.borderRadius}px !important;
      margin-bottom: 8px !important;
      transition: all 0.3s ease !important;
    }
    ${rowHover} {
      border-color: ${s.accentColor} !important;
      box-shadow: 0 0 15px ${glowRgba} !important;
      transform: scale(1.02) !important;
    }
    ${imageContainer} {
      border-radius: ${ir} !important;
      box-shadow: 0 0 12px ${glowRgba} !important;
      border: 2px solid ${s.accentColor} !important;
      overflow: hidden !important;
    }
    ${imageContainer.split(", ").map((c) => `${c} img`).join(", ")},
    ._2V2sHETNfa62yMoDwSF3_t {
      border-radius: ${ir} !important;
    }
    ${unlockInfo} {
      color: ${s.accentColor} !important;
      font-weight: bold !important;
    }
    @keyframes xbox-glow-pulse {
      0% { box-shadow: 0 0 5px ${glowRgba}; }
      50% { box-shadow: 0 0 20px ${glowRgbaStrong}, 0 0 40px ${glowRgba}; }
      100% { box-shadow: 0 0 5px ${glowRgba}; }
    }
    ${achievedGlowCSS}
  `;
}

// Shared CSS for all .ac-* decoration elements — used by both the test toast and
// native toast paths. Contains no parent-class selectors so it works in any context.
function buildSkyElementCSS(variant: DecorationVariant, accent: string): string {
  const clip = `
    .ac-sky-clip {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: -2;
      border-radius: inherit;
    }
  `;

  if (variant === "sparkles") {
    return `${clip}
      ${buildSparkleCSS(accent, "")}
      @media (prefers-reduced-motion: reduce) {
        .ac-sparkle { animation: none !important; opacity: 0.8 !important; }
      }
    `;
  }

  const base = `
    ${clip}

    .ac-drift-wrapper {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .ac-drift-track {
      display: flex;
      width: 200%;
      height: 100%;
    }
    .ac-drift-half {
      width: 50%;
      height: 100%;
      position: relative;
    }
    .ac-drift-back-clouds { animation: ac-drift-left 30s linear infinite; }
    .ac-drift-front-clouds { animation: ac-drift-left 20s linear infinite; }
    .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }

    @keyframes ac-drift-left {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ac-sun, .ac-moon, .ac-star,
      .ac-drift-back-clouds, .ac-drift-front-clouds, .ac-drift-stars {
        animation: none !important;
      }
    }
  `;

  if (variant === "sky-day") {
    return `${base}
      .ac-sun {
        position: absolute;
        top: 12px;
        right: 20px;
        width: 38px; height: 38px;
        background: #ECCA2F;
        border-radius: 50%;
        box-shadow:
          inset 1px 1px 2px rgba(254, 255, 239, 0.6),
          inset 0 -1px 2px rgba(161, 135, 42, 0.5);
        animation: ac-sun-pulse 4s infinite ease-in-out;
      }
      @keyframes ac-sun-pulse {
        0%, 100% { filter: drop-shadow(0 0 12px rgba(236, 202, 47, 0.3)); }
        50%      { filter: drop-shadow(0 0 12px rgba(236, 202, 47, 0.6)); }
      }

      .ac-birds {
        position: absolute;
        top: 25%;
        left: 38.89%;
        opacity: 0.5;
      }

      .ac-cloud-1, .ac-cloud-2, .ac-cloud-3 {
        position: absolute;
        border-radius: 50%;
      }
      .ac-cloud-1 {
        width: 45px; height: 45px;
        background: #F3FDFF;
        top: 72.92%; left: 4.17%;
        box-shadow:
          35px -10px 0 12px #F3FDFF,
          75px 5px 0 -5px #F3FDFF,
          -25px 8px 0 -8px #F3FDFF;
      }
      .ac-cloud-2 {
        width: 55px; height: 55px;
        background: #F3FDFF;
        top: 67.71%; left: 52.78%;
        box-shadow:
          40px 12px 0 -5px #F3FDFF,
          80px -8px 0 8px #F3FDFF,
          -35px 15px 0 -12px #F3FDFF,
          115px 15px 0 -10px #F3FDFF;
      }
      .ac-cloud-3 {
        width: 48px; height: 48px;
        background: #AACADF;
        top: 58.33%; left: 27.78%;
        box-shadow:
          45px -8px 0 6px #AACADF,
          95px 12px 0 -5px #AACADF,
          -40px 12px 0 -10px #AACADF,
          135px -5px 0 8px #AACADF,
          185px 10px 0 -8px #AACADF;
      }
    `;
  }

  return `${base}
    /* Single-element crescent, identical to the native toast's ::before moon.
       Never build the crescent from an opaque overlay circle: filter
       drop-shadow outlines the union of both circles as a smeared blob. */
    .ac-moon {
      position: absolute;
      top: 14px; right: 22px;
      width: 34px; height: 34px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 76% 41%, #2A2D3E 44%, transparent 45%),
        radial-gradient(circle, #C4C9D1 100%, transparent 100%);
      box-shadow: inset 1px 1px 2px rgba(254, 255, 239, 0.5);
      animation: ac-moon-pulse 5s infinite ease-in-out;
    }
    @keyframes ac-moon-pulse {
      0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.2)); }
      50%      { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.4)); }
    }

    .ac-star {
      position: absolute;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 0 4px rgba(255, 255, 255, 0.85);
      will-change: opacity, scale;
      animation: ac-twinkle 2.5s infinite ease-in-out alternate;
    }
    .ac-star-1  { width: 2px; height: 2px; top: 10%; left:  5%; animation-delay: 0s; }
    .ac-star-2  { width: 3px; height: 3px; top: 24%; left: 16%; animation-delay: 0.3s; }
    .ac-star-3  { width: 2px; height: 2px; top: 78%; left:  9%; animation-delay: 0.7s; }
    .ac-star-4  { width: 2px; height: 2px; top: 55%; left: 22%; animation-delay: 1.2s; }
    .ac-star-5  { width: 4px; height: 4px; top: 12%; left: 31%; animation-delay: 1.8s; }
    .ac-star-6  { width: 2px; height: 2px; top: 83%; left: 28%; animation-delay: 0.5s; }
    .ac-star-7  { width: 2px; height: 2px; top:  8%; left: 42%; animation-delay: 1.5s; }
    .ac-star-8  { width: 3px; height: 3px; top: 85%; left: 48%; animation-delay: 0.9s; }
    .ac-star-9  { width: 2px; height: 2px; top: 16%; left: 54%; animation-delay: 0.4s; animation-duration: 1.8s; }
    .ac-star-10 { width: 2px; height: 2px; top: 74%; left: 59%; animation-delay: 1.1s; }
    .ac-star-11 { width: 2px; height: 2px; top: 10%; left: 65%; animation-delay: 0.8s; animation-duration: 3.5s; }
    .ac-star-12 { width: 3px; height: 3px; top: 81%; left: 71%; animation-delay: 1.6s; }
    .ac-star-13 { width: 2px; height: 2px; top: 20%; left: 77%; animation-delay: 0.2s; }
    .ac-star-14 { width: 2px; height: 2px; top: 68%; left: 83%; animation-delay: 1.9s; animation-duration: 1.8s; }
    .ac-star-15 { width: 3px; height: 3px; top: 12%; left: 89%; animation-delay: 0.6s; animation-duration: 3.5s; }
    .ac-star-16 { width: 2px; height: 2px; top: 86%; left: 93%; animation-delay: 1.3s; }

    /* Scale as well as opacity: a 2px dot fading between 0.4 and 1.0 reads as
       static on a handheld screen. Standalone 'scale', never 'transform' — see
       the note on the entrance keyframes. */
    @keyframes ac-twinkle {
      0%   { opacity: 0.25; scale: 0.7; }
      100% { opacity: 1.0; scale: 1.25; }
    }

    .ac-constellation-path {
      position: absolute;
      fill: #fff;
    }
  `;
}

// Decoration layer for the custom-toast path. The card's stacking context is
// established by buildToastCSS; .ac-sky-clip sits at z-index -2 inside it, above
// the background and below all in-flow content.
function buildSkyCSS(variant: DecorationVariant, accent: string): string {
  // Sparkles overlay the themed card instead of replacing its background, and
  // need no reserved column since they avoid the text area by placement.
  if (!decorationOwnsBackground(variant)) {
    return `
      .achievement-customizer-content {
        position: static !important;
      }
      ${buildSkyElementCSS(variant, accent)}
    `;
  }

  const gradient =
    variant === "sky-day"
      ? "linear-gradient(160deg, #5EA6D6 0%, #3D7EAE 100%)"
      : "linear-gradient(160deg, #2A2D3E 0%, #1D1F2C 100%)";
  const reservePx = variant === "sky-day" ? 52 : 48;

  return `
    .achievement-customizer-toast {
      background: ${gradient} !important;
    }
    .achievement-customizer-content {
      position: static !important;
      padding-right: ${reservePx}px !important;
    }
    ${buildSkyElementCSS(variant, accent)}
  `;
}

function buildToastCSS(raw: ThemeSettings, rarity?: RarityOverride | null): string {
  const s = sanitizeSettings(raw);
  const accent = rarity?.accentColor || s.accentColor;
  const glow = s.glowEnabled
    ? `box-shadow: 0 0 ${s.glowIntensity}px ${accent}88, 0 0 ${s.glowIntensity * 3}px ${accent}44 !important;`
    : "box-shadow: none !important;";

  const bg =
    s.bannerStyle === "solid"
      ? `background: ${s.primaryColor} !important;`
      : s.bannerStyle === "glass"
        ? `background: ${s.primaryColor}cc !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;`
        : `background: linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor}) !important;`;

  const entrance = entranceCSS(safeEntrance(s.entranceStyle as string), s.borderRadius);
  const popupCSS = s.popupAnimation ? entrance.keyframes : "";

  const decoration = activeDecoration(s);
  const skyCSS = decoration ? buildSkyCSS(decoration, accent) : "";
  const shineCSS = s.shineEnabled
    ? buildShineCSS(".achievement-customizer-toast", { intense: rarity?.shineIntense ?? false })
    : "";

  return `
    ${popupCSS}

    /* The stacking context is unconditional: the shine overlay and the decoration
       clip layer both position against this card, and both exist independently
       of whether a decoration is active. */
    .achievement-customizer-toast {
      overflow: visible !important;
      position: relative !important;
      z-index: 0 !important;
      isolation: isolate !important;
      ${bg}
      border: 2px solid ${accent} !important;
      border-radius: ${s.borderRadius}px !important;
      ${glow}
      padding: 10px 14px !important;
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      gap: 12px !important;
      height: auto !important;
      min-height: 44px;
      ${s.popupAnimation ? entrance.animation : ""}
    }

    .achievement-customizer-toast > * {
      min-width: 0;
    }

    .achievement-customizer-toast > div {
      background: transparent !important;
    }

    .achievement-customizer-content {
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }

    .achievement-customizer-toast img {
      border-radius: ${iconRadius(s.iconShape)} !important;
      border: ${s.iconBorder ? `2px solid ${accent}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${accent}66` : "none"} !important;
      flex-shrink: 0;
    }

    ${rarity?.extraCSS || ""}
    ${skyCSS}
    ${shineCSS}

    @media (prefers-reduced-motion: reduce) {
      .achievement-customizer-toast {
        animation: none !important;
      }
      .achievement-customizer-toast::after {
        animation: none !important;
        opacity: 0 !important;
      }
    }
  `;
}

let currentSettings: ThemeSettings = { preset: "xbox", ...PRESETS.xbox };
let currentPageCssId: string | null = null;

// Try all plausible notification webview names — the UID suffix changes between games/sessions.
// Range 0–9 covers the observed rotation; failing tabs are silently ignored.
const NOTIF_TAB_NAMES = [
  "notificationtoasts_uid0", "notificationtoasts_uid1",
  "notificationtoasts_uid2", "notificationtoasts_uid3",
  "notificationtoasts_uid4", "notificationtoasts_uid5",
  "notificationtoasts_uid6", "notificationtoasts_uid7",
  "notificationtoasts_uid8", "notificationtoasts_uid9",
];

// Steam renders every popup toast variant (achievement, download complete,
// friend online, now playing, messages) through one shared template whose CSS
// module has semantic keys. Resolving the class names at runtime by key — the
// same lookup Decky Loader's own toaster uses — survives Steam updates that
// re-hash class names. The hardcoded hashes below are fallbacks captured from
// a live Deck DOM in case the module lookup fails.
interface MaybeToastClassModule {
  ShortTemplate?: string;
  StandardTemplateContainer?: string;
  StandardLogoDimensions?: string;
  Content?: string;
  Header?: string;
  Icon?: string;
  Title?: string;
  Body?: string;
}

const LEGACY_TOAST_CLASSES: Partial<Record<keyof MaybeToastClassModule, string>> = {
  StandardLogoDimensions: "_1fEbX-PfpZ2FhkhttWcm-V",
  Icon: "_2F0wqsu2mqsHxBSJcu1sPJ",
  Title: "_18PwvOcpWfW3M8j2-bEPPJ",
  Body: "_2jpxEWvo06efD6-NR1cplA",
};

let cachedToastClasses: MaybeToastClassModule | null = null;

function getToastTemplateClasses(): MaybeToastClassModule {
  if (!cachedToastClasses) {
    try {
      // Filter on ShortTemplate only — the exact lookup Decky Loader's own
      // toaster uses. Requiring more keys makes resolution fail entirely when
      // Steam renames any single one, which silently kills every rule that
      // has no legacy-hash fallback (Content/Header).
      const found = findClassModule((m) => m?.ShortTemplate) as MaybeToastClassModule | undefined;
      if (found) cachedToastClasses = found;
    } catch (e) {
      // Never let a webpack-module walk break CSS injection; legacy hashes
      // and [class*=] fallbacks still apply.
      console.warn("[AchievementCustomizer] toast class lookup failed:", e);
    }
  }
  return cachedToastClasses ?? {};
}

const TOAST_SCOPE = 'div[role="alert"]';

// Selector list for one toast template part, scoped to the toast root:
// runtime-resolved class, legacy hash, plus a [class*="_Part_"] fallback that
// matches the newer semantic naming scheme (e.g. notificationtoasts_Title_x1y2).
function toastPartSelector(part: keyof MaybeToastClassModule): string {
  const selectors: string[] = [];
  const resolved = getToastTemplateClasses()[part];
  if (resolved && CSS_CLASS_RE.test(resolved)) selectors.push(`${TOAST_SCOPE} .${resolved}`);
  const legacy = LEGACY_TOAST_CLASSES[part];
  if (legacy && legacy !== resolved) selectors.push(`${TOAST_SCOPE} .${legacy}`);
  selectors.push(`${TOAST_SCOPE} [class*="_${part}_"]`);
  return [...new Set(selectors)].join(", ");
}

// The visible toast card. Valve wraps native popup toasts in .Panel; toasts
// rendered by Decky (including our test toasts) use the bare template root.
function toastCardSelector(): string {
  const selectors = [
    `${TOAST_SCOPE} > .Panel`,
    `${TOAST_SCOPE} > [role="button"]`,
    `${TOAST_SCOPE} > [class*="ShortTemplate"]`,
  ];
  const short = getToastTemplateClasses().ShortTemplate;
  if (short && CSS_CLASS_RE.test(short)) selectors.push(`${TOAST_SCOPE} > .${short}`);
  return [...new Set(selectors)].join(", ");
}

// Appends a suffix (child combinator, pseudo-element, ...) to every selector
// in a comma-separated list.
function eachSelector(selectorList: string, suffix: string): string {
  return selectorList.split(",").map((sel) => `${sel.trim()}${suffix}`).join(", ");
}

function buildNativeToastCSS(raw: ThemeSettings): string {
  const s = sanitizeSettings(raw);
  const ir = iconRadius(s.iconShape);
  const glow = s.glowEnabled
    ? `box-shadow: 0 0 ${s.glowIntensity}px ${s.accentColor}88, 0 0 ${s.glowIntensity * 3}px ${s.accentColor}44 !important;`
    : "box-shadow: none !important;";

  const bg =
    s.bannerStyle === "solid"
      ? `background: ${s.primaryColor} !important;`
      : s.bannerStyle === "glass"
        ? `background: ${s.primaryColor}cc !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;`
        : `background: linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor}) !important;`;

  const entrance = entranceCSS(safeEntrance(s.entranceStyle as string), s.borderRadius);
  const popupCSS = s.popupAnimation ? entrance.keyframes : "";

  const card = toastCardSelector();
  const logo = toastPartSelector("StandardLogoDimensions");
  const content = toastPartSelector("Content");
  const header = toastPartSelector("Header");
  const icon = toastPartSelector("Icon");
  const title = toastPartSelector("Title");
  const body = toastPartSelector("Body");

  const tc = getToastTemplateClasses();
  const resolvedIndentRule =
    tc.Header && tc.Icon && tc.Body &&
    CSS_CLASS_RE.test(tc.Header) && CSS_CLASS_RE.test(tc.Icon) && CSS_CLASS_RE.test(tc.Body)
      ? `${TOAST_SCOPE} .${tc.Header}:has(.${tc.Icon}) + .${tc.Body} { padding-left: 24px !important; }`
      : "";

  return `
    ${popupCSS}

    ._3YTh805w3-xgPkHE_22XcA {
      overflow: visible !important;
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      animation: none !important;
      transition: none !important;
    }

    div[role="alert"] {
      overflow: visible !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    /* Toast card, shared by every variant: flex row, content-driven height.
       z-index:0 + isolation pin a stacking context so sky decorations can sit
       in the negative z band — above the background, below all text.
       No width/margin/box-sizing changes: Steam's outer placement logic must
       keep positioning the toast exactly as it does stock. */
    ${card} {
      ${bg}
      border: 2px solid ${s.accentColor} !important;
      border-radius: ${s.borderRadius}px !important;
      padding: 10px 14px !important;
      ${glow}
      position: relative !important;
      z-index: 0 !important;
      isolation: isolate !important;
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      gap: 12px !important;
      height: auto !important;
      min-height: 44px;
      ${s.popupAnimation ? entrance.animation : ""}
    }

    /* Children may shrink so text can truncate instead of overflowing. */
    ${eachSelector(card, " > *")} {
      min-width: 0;
    }

    /* Left icon/avatar column: fixed footprint, never shrinks. */
    ${logo} {
      flex: 0 0 44px !important;
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      border-radius: ${ir} !important;
      overflow: hidden !important;
      border: ${s.iconBorder ? `2px solid ${s.accentColor}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${s.accentColor}66` : "none"} !important;
    }

    ${eachSelector(logo, " img")},
    div[role="alert"] ._2V2sHETNfa62yMoDwSF3_t {
      border-radius: ${ir} !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }

    /* Text column: takes remaining width; min-width:0 is required for
       ellipsis/clamping to engage inside a flex row. The structural
       :has(> body/title) twins below cover Steam builds where the class
       module lookup misses — Content/Header have no legacy hash. */
    ${content} {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-self: center !important;
      gap: 3px !important;
    }
    ${TOAST_SCOPE} :has(> ._2jpxEWvo06efD6-NR1cplA) {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-self: center !important;
      gap: 3px !important;
    }

    ${header} {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      min-width: 0 !important;
    }
    ${TOAST_SCOPE} :has(> ._18PwvOcpWfW3M8j2-bEPPJ) {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      min-width: 0 !important;
    }

    ${icon} {
      color: ${s.accentColor} !important;
      flex: 0 0 auto !important;
    }
    ${eachSelector(icon, " svg")} {
      color: ${s.accentColor} !important;
      fill: currentColor !important;
      width: 18px !important;
      height: 18px !important;
    }

    /* The medal icon sits inline before the title, so indent the body line by
       icon width + gap (18 + 6) — title text and description share one left
       edge. :has() scoping keeps icon-less variants (friend, download) flush;
       where :has() is unsupported this degrades to no indent. */
    ${TOAST_SCOPE} [class*="_Header_"]:has([class*="_Icon_"]) + [class*="_Body_"] {
      padding-left: 24px !important;
    }
    ${TOAST_SCOPE} :has(> ._18PwvOcpWfW3M8j2-bEPPJ):has(._2F0wqsu2mqsHxBSJcu1sPJ) + ._2jpxEWvo06efD6-NR1cplA {
      padding-left: 24px !important;
    }
    ${resolvedIndentRule}

    /* Title: always a single ellipsized line. */
    ${title} {
      color: ${s.textColor} !important;
      font-weight: bold !important;
      font-size: 14px !important;
      line-height: 1.25 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      min-width: 0 !important;
      max-width: 100% !important;
      margin: 0 !important;
      transform: none !important;
    }

    /* Body/status line: clamps to two lines, never paints over neighbors. */
    ${body} {
      color: ${s.descColor} !important;
      font-size: 12px !important;
      line-height: 1.25 !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      white-space: normal !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      transform: none !important;
    }

    /* Native rarity is unknown at CSS-build time, so the sweep is always the
       plain variant here. Every toast variant shares this card selector, so
       friend/download toasts get the same sweep — consistent, and off entirely
       when the user disables it. */
    ${s.shineEnabled ? buildShineCSS(card, { intense: false }) : ""}

    @media (prefers-reduced-motion: reduce) {
      ${card} {
        animation: none !important;
      }
      ${eachSelector(card, "::after")} {
        animation: none !important;
        opacity: 0 !important;
      }
    }

    ${buildNativeSkyCSS(activeDecoration(s), s.accentColor)}
  `;
}

// CSS for the native notification toast's decorations.
// ::before = crescent moon (sky-night) or sun (sky-day) — proven to render in Steam's WebKit.
// Stars, clouds and sparkles are DOM elements injected by injectNotifCSS; their CSS
// rules must live here (not in the Big Picture Mode stylesheet) so the notification
// webview can resolve them.
function buildNativeSkyCSS(variant: DecorationVariant | null, accent: string): string {
  const card = toastCardSelector();
  const cardBefore = eachSelector(card, "::before");
  const title = toastPartSelector("Title");
  const body = toastPartSelector("Body");
  const content = toastPartSelector("Content");

  // Reserve the sun/moon column inside the text column, never as card
  // padding: growing the card's width shifts Steam's toast placement.
  const contentReservation = (px: number) => `
    ${content} {
      padding-right: ${px}px !important;
    }
    ${TOAST_SCOPE} :has(> ._2jpxEWvo06efD6-NR1cplA) {
      padding-right: ${px}px !important;
    }
    .achievement-customizer-content {
      padding-right: ${px}px !important;
    }
  `;

  // Decorations paint in the negative z band of the card's stacking context:
  // above the card background, below every in-flow child (text, icons).
  // Steam's own children are left untouched — forcing position/z-index on
  // them broke friend/download toast internals.
  const driftBase = `
    div[role="alert"] .ac-sky-clip {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: -2;
      border-radius: inherit;
    }
    div[role="alert"] .ac-drift-wrapper {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    div[role="alert"] .ac-drift-track { display: flex; width: 200%; height: 100%; }
    div[role="alert"] .ac-drift-half  { width: 50%; height: 100%; position: relative; }
    @keyframes ac-drift-left {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @media (prefers-reduced-motion: reduce) {
      div[role="alert"] .ac-star,
      div[role="alert"] .ac-drift-back-clouds,
      div[role="alert"] .ac-drift-front-clouds,
      div[role="alert"] .ac-drift-stars,
      ${cardBefore} {
        animation: none !important;
      }
    }
  `;

  if (variant === "sparkles") {
    // No background override and no reserved column: sparkles sit over whatever
    // theme the user picked. Only the clip layer is needed from driftBase.
    return `
      div[role="alert"] .ac-sky-clip {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: -2;
        border-radius: inherit;
      }
      ${buildSparkleCSS(accent, 'div[role="alert"]')}
      @media (prefers-reduced-motion: reduce) {
        div[role="alert"] .ac-sparkle { animation: none !important; opacity: 0.8 !important; }
      }
    `;
  }

  if (variant === "sky-day") {
    return `
      ${card} {
        background: linear-gradient(160deg, #5EA6D6 0%, #3D7EAE 100%) !important;
      }
      ${contentReservation(52)}
      ${cardBefore} {
        content: '';
        position: absolute;
        top: 12px; right: 20px;
        width: 38px; height: 38px;
        background: #ECCA2F;
        border-radius: 50%;
        box-shadow: inset 1px 1px 2px rgba(254,255,239,0.6), inset 0 -1px 2px rgba(161,135,42,0.5);
        animation: ac-native-sun-pulse 4s infinite ease-in-out;
        pointer-events: none;
        z-index: -1;
      }
      @keyframes ac-native-sun-pulse {
        0%, 100% { filter: drop-shadow(0 0 12px rgba(236,202,47,0.25)); }
        50%      { filter: drop-shadow(0 0 16px rgba(236,202,47,0.75)); }
      }
      div[role="alert"] .ac-cloud-1,
      div[role="alert"] .ac-cloud-2,
      div[role="alert"] .ac-cloud-3 { position: absolute; border-radius: 50%; }
      div[role="alert"] .ac-cloud-1 {
        width: 45px; height: 45px; background: #F3FDFF; top: 72.92%; left: 4.17%;
        box-shadow: 35px -10px 0 12px #F3FDFF, 75px 5px 0 -5px #F3FDFF, -25px 8px 0 -8px #F3FDFF;
      }
      div[role="alert"] .ac-cloud-2 {
        width: 55px; height: 55px; background: #F3FDFF; top: 67.71%; left: 52.78%;
        box-shadow: 40px 12px 0 -5px #F3FDFF, 80px -8px 0 8px #F3FDFF, -35px 15px 0 -12px #F3FDFF, 115px 15px 0 -10px #F3FDFF;
      }
      div[role="alert"] .ac-cloud-3 {
        width: 48px; height: 48px; background: #AACADF; top: 58.33%; left: 27.78%;
        box-shadow: 45px -8px 0 6px #AACADF, 95px 12px 0 -5px #AACADF, -40px 12px 0 -10px #AACADF, 135px -5px 0 8px #AACADF, 185px 10px 0 -8px #AACADF;
      }
      div[role="alert"] .ac-drift-back-clouds  { animation: ac-drift-left 30s linear infinite; }
      div[role="alert"] .ac-drift-front-clouds { animation: ac-drift-left 20s linear infinite; }
      ${driftBase}
    `;
  }

  if (variant === "sky-night") {
    // Stars use DOM injection (same approach as sky-day clouds) because CSS @property
    // animation is unreliable in Steam's notification webview CEF. DOM .ac-star elements
    // are injected by injectNotifCSS's webview-internal poll after Steam fills the card.
    // ::before handles the moon (CSS-only, survives any innerHTML reset).
    return `
      ${card} {
        background: linear-gradient(160deg, #2A2D3E 0%, #1D1F2C 100%) !important;
      }
      ${contentReservation(48)}

      ${cardBefore} {
        content: '';
        position: absolute;
        top: 14px; right: 22px;
        width: 34px; height: 34px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 76% 41%, #2A2D3E 44%, transparent 45%),
          radial-gradient(circle, #C4C9D1 100%, transparent 100%);
        box-shadow: inset 1px 1px 2px rgba(254,255,239,0.5);
        animation: ac-native-moon-pulse 5s infinite ease-in-out;
        pointer-events: none;
        z-index: -1;
      }
      @keyframes ac-native-moon-pulse {
        0%, 100% { filter: drop-shadow(0 0 5px rgba(255,255,255,0.2)); }
        50%      { filter: drop-shadow(0 0 5px rgba(255,255,255,0.4)); }
      }

      /* Constellations drift behind the text; a soft shadow keeps it legible
         when they pass underneath. */
      ${title} {
        text-shadow: 0 0 8px rgba(20,22,35,0.9), 0 1px 3px rgba(0,0,0,0.6) !important;
      }
      ${body} {
        text-shadow: 0 0 6px rgba(20,22,35,0.9), 0 1px 2px rgba(0,0,0,0.5) !important;
      }

      div[role="alert"] .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }

      div[role="alert"] .ac-star {
        position: absolute;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 4px rgba(255, 255, 255, 0.85);
        will-change: opacity, scale;
        animation: ac-twinkle 2.5s infinite ease-in-out alternate;
      }
      div[role="alert"] .ac-star-1  { width: 2px; height: 2px; top: 10%;  left:  5%;  animation-delay: 0s; }
      div[role="alert"] .ac-star-2  { width: 3px; height: 3px; top: 24%;  left: 16%;  animation-delay: 0.3s; }
      div[role="alert"] .ac-star-3  { width: 2px; height: 2px; top: 78%;  left:  9%;  animation-delay: 0.7s; }
      div[role="alert"] .ac-star-4  { width: 2px; height: 2px; top: 55%;  left: 22%;  animation-delay: 1.2s; }
      div[role="alert"] .ac-star-5  { width: 4px; height: 4px; top: 12%;  left: 31%;  animation-delay: 1.8s; }
      div[role="alert"] .ac-star-6  { width: 2px; height: 2px; top: 83%;  left: 28%;  animation-delay: 0.5s; }
      div[role="alert"] .ac-star-7  { width: 2px; height: 2px; top:  8%;  left: 42%;  animation-delay: 1.5s; }
      div[role="alert"] .ac-star-8  { width: 3px; height: 3px; top: 85%;  left: 48%;  animation-delay: 0.9s; }
      div[role="alert"] .ac-star-9  { width: 2px; height: 2px; top: 16%;  left: 54%;  animation-delay: 0.4s; animation-duration: 1.8s; }
      div[role="alert"] .ac-star-10 { width: 2px; height: 2px; top: 74%;  left: 59%;  animation-delay: 1.1s; }
      div[role="alert"] .ac-star-11 { width: 2px; height: 2px; top: 10%;  left: 65%;  animation-delay: 0.8s; animation-duration: 3.5s; }
      div[role="alert"] .ac-star-12 { width: 3px; height: 3px; top: 81%;  left: 71%;  animation-delay: 1.6s; }
      div[role="alert"] .ac-star-13 { width: 2px; height: 2px; top: 20%;  left: 77%;  animation-delay: 0.2s; }
      div[role="alert"] .ac-star-14 { width: 2px; height: 2px; top: 68%;  left: 83%;  animation-delay: 1.9s; animation-duration: 1.8s; }
      div[role="alert"] .ac-star-15 { width: 3px; height: 3px; top: 12%;  left: 89%;  animation-delay: 0.6s; animation-duration: 3.5s; }
      div[role="alert"] .ac-star-16 { width: 2px; height: 2px; top: 86%;  left: 93%;  animation-delay: 1.3s; }
      @keyframes ac-twinkle {
        0%   { opacity: 0.25; scale: 0.7; }
        100% { opacity: 1.0; scale: 1.25; }
      }

      div[role="alert"] .ac-constellation-path {
        position: absolute;
        fill: #fff;
      }
      ${driftBase}
    `;
  }

  return "";
}

// Escape for embedding inside a template literal in generated webview JS.
function escapeForTemplateLiteral(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

// Short djb2 hash identifying one "generation" of injected CSS + sky setup.
// The webview script early-returns when the generation is unchanged: replacing
// the <style> element cancels and restarts every CSS animation it defines, so
// the old remove-and-recreate-every-second approach kept resetting twinkle and
// drift animations to t=0 — they looked frozen on device.
function contentHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// Webview-side sky-DOM helpers shared by the persistent poll (injectNotifCSS)
// and the per-achievement snippet (buildSkyInjectionSnippet) so the two copies
// cannot drift. Expects `_h` (clip HTML) and `_v` (variant name) in scope.
// Clips rendered by React inside custom toasts are marked data-ac-react and
// must never be removed here — React still owns those nodes.
const SKY_INJECT_HELPERS_JS =
  "function _inj(p){var ex=p.querySelector('.ac-sky-clip');if(ex){if(ex.getAttribute('data-ac-react')||ex.getAttribute('data-ac-variant')===_v)return;ex.remove();}p.style.position='relative';p.style.zIndex='0';p.style.isolation='isolate';var t=document.createElement('div');t.innerHTML=_h;var c=t.firstElementChild;if(c){c.setAttribute('data-ac-variant',_v);p.insertBefore(c,p.firstChild);}}" +
  "function _poll(){document.querySelectorAll('div[role=\"alert\"] > .Panel,div[role=\"alert\"] > [role=\"button\"],div[role=\"alert\"] > [class*=\"ShortTemplate\"]').forEach(function(p){_inj(p);});}";

// One-shot injection of decoration DOM into already-rendered toast cards.
function buildSkyInjectionSnippet(skyVariant: DecorationVariant): string {
  const esc = escapeForTemplateLiteral(buildNativeSkyDOMHTML(skyVariant));
  return `(function(){var _h=\`${esc}\`;var _v=${JSON.stringify(skyVariant)};${SKY_INJECT_HELPERS_JS}_poll();})();`;
}

// Injects CSS into every candidate notification tab.
// Decorations that need real DOM (clouds, stars, sparkles) get a MutationObserver
// plus a slow poll inside the webview so they attach to newly rendered toast cards.
//
// Everything here is idempotent and keyed on a generation hash: repeat calls with
// unchanged settings touch nothing. That is load-bearing, not an optimisation —
// this runs on an interval, and replacing the <style> element or re-creating the
// observer cancels every in-flight CSS animation and restarts it at t=0.
function injectNotifCSS(s: ThemeSettings): void {
  const css = buildNativeToastCSS(s);
  const escapedCSS = escapeForTemplateLiteral(css);
  const decoration = activeDecoration(s);
  const generation = contentHash(`${decoration ?? "none"}|${css}`);

  const teardown =
    "if(window.__acSkyObs){window.__acSkyObs.disconnect();window.__acSkyObs=null;}" +
    "if(window.__acSkyPoll){clearInterval(window.__acSkyPoll);window.__acSkyPoll=null;}" +
    "document.querySelectorAll('.ac-sky-clip:not([data-ac-react])').forEach(function(e){e.remove();});";

  let skySetup = teardown;
  if (decoration) {
    const escapedSkyHTML = escapeForTemplateLiteral(buildNativeSkyDOMHTML(decoration));
    // The poll runs entirely inside the webview (no IPC round-trip), so decorations
    // attach on their own even if the observer misses a mutation. The observer is
    // the fast path; the interval only exists as a safety net, hence 250ms.
    skySetup = `${teardown}
var _h=\`${escapedSkyHTML}\`;
var _v=${JSON.stringify(decoration)};
${SKY_INJECT_HELPERS_JS}
_poll();
window.__acSkyPoll=setInterval(_poll,250);
var _obs=new MutationObserver(function(){_poll();});
_obs.observe(document.body,{childList:true,subtree:true});
window.__acSkyObs=_obs;`;
  }

  const script = `(function(){var G=${JSON.stringify(generation)};` +
    `var el=document.getElementById("achievement-customizer-notif-css");` +
    `if(el&&el.getAttribute("data-ac-gen")===G&&window.__acSkyGen===G)return;` +
    `if(el)el.remove();` +
    `var style=document.createElement("style");style.id="achievement-customizer-notif-css";` +
    `style.setAttribute("data-ac-gen",G);style.textContent=\`${escapedCSS}\`;document.head.appendChild(style);` +
    `${skySetup}window.__acSkyGen=G;})();`;

  for (const tab of NOTIF_TAB_NAMES) {
    executeInTab(tab, false, script).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// AC-PROBE: TEMPORARY DIAGNOSTIC BLOCK. Phase 1 of the native-toast
// investigation. Answers, from the live Deck DOM rather than by guessing:
//   1. which notification webview actually holds our CSS (the 10-tab fan-out
//      at NOTIF_TAB_NAMES swallows every failure, so today we cannot tell);
//   2. how many elements resolve a painted ::before — i.e. how many moons, and
//      anchored to which box (the two-moons / full-moon-in-icon-slot report);
//   3. whether a stale sky-day <style> or .ac-sky-clip is still present while
//      the preset says sky-night (the day-theme report);
//   4. the real on-device pill width vs the text column width (the clipped
//      body-text report).
// Delete this entire block, the debugLog callable, and Plugin.debug_log in
// main.py once the DOM is characterized.
// ---------------------------------------------------------------------------

const PROBE_SCRIPT = `(function(){
try{
  var out={href:location.href,acSkyGen:(window.__acSkyGen||null),alerts:[],clips:[]};

  var st=document.getElementById("achievement-customizer-notif-css");
  out.styleTags=document.querySelectorAll('style[id^="achievement-customizer"]').length;
  if(st){
    var t=st.textContent||"";
    out.styleGen=st.getAttribute("data-ac-gen");
    out.styleLen=t.length;
    out.styleHasDayGradient=t.indexOf("#5EA6D6")>=0;
    out.styleHasNightGradient=t.indexOf("#2A2D3E")>=0;
    out.styleHasSunPulse=t.indexOf("ac-native-sun-pulse")>=0;
    out.styleHasMoonPulse=t.indexOf("ac-native-moon-pulse")>=0;
  }

  document.querySelectorAll(".ac-sky-clip").forEach(function(c){
    out.clips.push({
      variant:c.getAttribute("data-ac-variant"),
      react:!!c.getAttribute("data-ac-react"),
      kids:c.children.length,
      suns:c.querySelectorAll(".ac-sun").length,
      moons:c.querySelectorAll(".ac-moon").length,
      stars:c.querySelectorAll(".ac-star").length,
      clouds:c.querySelectorAll(".ac-cloud-1,.ac-cloud-2,.ac-cloud-3").length,
      parentCls:String((c.parentElement&&c.parentElement.className)||"").slice(0,100)
    });
  });

  var SEL=['div[role="alert"] > .Panel','div[role="alert"] > [role="button"]','div[role="alert"] > [class*="ShortTemplate"]'];

  document.querySelectorAll('div[role="alert"]').forEach(function(a,ai){
    var ar=a.getBoundingClientRect();
    var rec={i:ai,alertW:Math.round(ar.width),children:[],painted:[]};

    Array.prototype.forEach.call(a.children,function(ch){
      var m=[];
      SEL.forEach(function(s,si){ try{ if(ch.matches(s)) m.push(si); }catch(e){} });
      var r=ch.getBoundingClientRect();
      rec.children.push({
        tag:ch.tagName,role:ch.getAttribute("role"),
        cls:String(ch.className||"").slice(0,120),
        w:Math.round(r.width),h:Math.round(r.height),
        cardSelectorMatches:m
      });
    });

    // Every element in the toast whose ::before actually paints something of
    // moon/sun size. This is the direct answer to "how many moons, and where".
    var all=[a];
    Array.prototype.push.apply(all,a.querySelectorAll("*"));
    all.forEach(function(el){
      var cs;
      try{ cs=getComputedStyle(el,"::before"); }catch(e){ return; }
      if(!cs) return;
      var c=cs.content;
      if(!c||c==="none"||c==="normal") return;
      var bw=parseFloat(cs.width)||0;
      if(bw<8) return;
      var r=el.getBoundingClientRect();
      rec.painted.push({
        cls:String(el.className||"").slice(0,90),
        beforeW:cs.width,beforeH:cs.height,
        top:cs.top,right:cs.right,borderRadius:cs.borderRadius,
        bg:String(cs.backgroundImage||"").slice(0,70),
        hostLeft:Math.round(r.left),hostW:Math.round(r.width),hostH:Math.round(r.height)
      });
    });

    // Width accounting for the clipped-body-text report.
    var content=a.querySelector('[class*="_Content_"],._2jpxEWvo06efD6-NR1cplA');
    if(content){
      var ccs=getComputedStyle(content);
      rec.contentW=Math.round(content.getBoundingClientRect().width);
      rec.contentPadRight=ccs.paddingRight;
    }
    var logo=a.querySelector('[class*="_StandardLogoDimensions_"],._1fEbX-PfpZ2FhkhttWcm-V');
    if(logo){
      var lr=logo.getBoundingClientRect();
      rec.logo={w:Math.round(lr.width),h:Math.round(lr.height),
        left:Math.round(lr.left),pos:getComputedStyle(logo).position,
        overflow:getComputedStyle(logo).overflow,
        imgs:logo.querySelectorAll("img").length};
    }
    rec.imgs=[];
    a.querySelectorAll("img").forEach(function(im){
      rec.imgs.push({w:im.naturalWidth,h:im.naturalHeight,
        complete:im.complete,src:String(im.src||"").slice(0,80)});
    });

    rec.html=a.outerHTML.slice(0,1400);
    out.alerts.push(rec);
  });

  return JSON.stringify(out);
}catch(e){ return JSON.stringify({probeError:String(e&&e.stack||e)}); }
})()`;

function probeChunkOut(label: string, tab: string, text: string): void {
  const CHUNK = 1200;
  const total = Math.ceil(text.length / CHUNK) || 1;
  for (let i = 0; i < total; i++) {
    const part = text.slice(i * CHUNK, (i + 1) * CHUNK);
    debugLog(`${label} ${tab} [${i + 1}/${total}] ${part}`).catch(() => {});
  }
}

// executeInTab's return shape is not pinned down by @decky/api's types (result
// is `any`), so unwrap defensively rather than assuming one CDP envelope.
function unwrapProbeResult(res: { success: boolean; result: unknown }): string | null {
  if (!res || !res.success) return null;
  const r = res.result as Record<string, unknown> | string | null | undefined;
  if (typeof r === "string") return r;
  const inner = (r as Record<string, Record<string, unknown>> | null)?.result;
  const v = (inner?.value ?? (r as Record<string, unknown> | null)?.value) as unknown;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(r);
  } catch {
    return null;
  }
}

function runToastProbe(label: string): void {
  debugLog(`${label} --- probe start, preset=${currentSettings.preset} decor=${currentSettings.decorativeElements} ---`).catch(() => {});
  for (const tab of NOTIF_TAB_NAMES) {
    executeInTab(tab, false, PROBE_SCRIPT)
      .then((res) => {
        const text = unwrapProbeResult(res);
        // Tabs that do not exist reject or come back empty; only report live ones.
        if (!text || text === "null") return;
        probeChunkOut(label, tab, text);
      })
      .catch(() => {});
  }
}

// ------------------------- end AC-PROBE block ------------------------------

function buildConstellationHalfHTML(): string {
  return CONSTELLATIONS.map((c) =>
    `<svg class="ac-constellation-path" viewBox="133 0 8 9" style="position:absolute;top:${c.top};left:${c.left};width:${c.width};opacity:${c.opacity};fill:#fff;"><path d="${CONSTELLATION_PATH_D}"/></svg>`
  ).join("");
}

// Returns the .ac-sky-clip HTML for stars/constellations (night), birds/clouds
// (day), or sparkles. Moon/sun are handled by CSS ::before and must NOT be
// included here. This HTML is embedded in the persistent MutationObserver set up
// by injectNotifCSS.
function buildNativeSkyDOMHTML(variant: DecorationVariant): string {
  let inner: string;
  if (variant === "sparkles") {
    inner = sparkleDOMHTML();
  } else if (variant === "sky-night") {
    const half = buildConstellationHalfHTML();
    inner =
      '<div class="ac-star ac-star-1"></div>' +
      '<div class="ac-star ac-star-2"></div>' +
      '<div class="ac-star ac-star-3"></div>' +
      '<div class="ac-star ac-star-4"></div>' +
      '<div class="ac-star ac-star-5"></div>' +
      '<div class="ac-star ac-star-6"></div>' +
      '<div class="ac-star ac-star-7"></div>' +
      '<div class="ac-star ac-star-8"></div>' +
      '<div class="ac-star ac-star-9"></div>' +
      '<div class="ac-star ac-star-10"></div>' +
      '<div class="ac-star ac-star-11"></div>' +
      '<div class="ac-star ac-star-12"></div>' +
      '<div class="ac-star ac-star-13"></div>' +
      '<div class="ac-star ac-star-14"></div>' +
      '<div class="ac-star ac-star-15"></div>' +
      '<div class="ac-star ac-star-16"></div>' +
      '<div class="ac-drift-wrapper">' +
        '<div class="ac-drift-track ac-drift-stars">' +
          `<div class="ac-drift-half">${half}</div>` +
          `<div class="ac-drift-half">${half}</div>` +
        '</div>' +
      '</div>';
  } else {
    inner =
      '<svg class="ac-birds" viewBox="0 0 60 20" width="40" height="20" style="position:absolute;top:25%;left:38.89%;opacity:0.5;">' +
        '<path d="M2 10 Q 7 2 12 10 Q 17 2 22 10" fill="none" stroke="#FFF8E7" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M25 15 Q 30 7 35 15 Q 40 7 45 15" fill="none" stroke="#FFF8E7" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="ac-drift-wrapper">' +
        '<div class="ac-drift-track ac-drift-back-clouds">' +
          '<div class="ac-drift-half"><div class="ac-cloud-3"></div></div>' +
          '<div class="ac-drift-half"><div class="ac-cloud-3"></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="ac-drift-wrapper">' +
        '<div class="ac-drift-track ac-drift-front-clouds">' +
          '<div class="ac-drift-half"><div class="ac-cloud-1"></div><div class="ac-cloud-2"></div></div>' +
          '<div class="ac-drift-half"><div class="ac-cloud-1"></div><div class="ac-cloud-2"></div></div>' +
        '</div>' +
      '</div>';
  }
  return `<div class="ac-sky-clip">${inner}</div>`;
}

function reinjectAllCSS(s: ThemeSettings): void {
  if (currentPageCssId) {
    removeCssFromTab("Steam Big Picture Mode", currentPageCssId);
  }

  currentPageCssId = injectCssIntoTab(
    "Steam Big Picture Mode",
    buildAchievementPageCSS(s),
  );

  injectNotifCSS(s);
  // Retry after 5 s in case the notification tab hasn't loaded yet at startup
  setTimeout(() => injectNotifCSS(s), 5000);
}

function saveSettingsSafe(settings: ThemeSettings): void {
  saveSettings(settings).catch((error) => {
    console.error("[AchievementCustomizer] Failed to save settings", error);
  });
}

const ACHIEVEMENT_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path d="M30 30.05H26L24 34.05L20.11 27.57L22.9 24.8701L26.9 24.81L30 30.05ZM13.1 24.8701L9.1 24.81L6 30.05H10L12 34.05L15.89 27.57L13.1 24.8701ZM22.5 13.05C22.5 12.16 22.2361 11.29 21.7416 10.55C21.2471 9.80996 20.5443 9.23318 19.7221 8.89259C18.8998 8.552 17.995 8.46288 17.1221 8.63651C16.2492 8.81015 15.4474 9.23873 14.818 9.86807C14.1887 10.4974 13.7601 11.2992 13.5865 12.1721C13.4128 13.0451 13.5019 13.9499 13.8425 14.7721C14.1831 15.5944 14.7599 16.2972 15.4999 16.7917C16.24 17.2861 17.11 17.55 18 17.55C18.5913 17.5514 19.1771 17.4359 19.7236 17.2102C20.2702 16.9845 20.7668 16.6531 21.1849 16.235C21.603 15.8168 21.9345 15.3202 22.1601 14.7737C22.3858 14.2271 22.5013 13.6414 22.5 13.05ZM29 13.05L25.85 16.3L25.78 20.83L21.25 20.9L18 24.05L14.75 20.9L10.22 20.83L10.15 16.3L7 13.05L10.15 9.80005L10.22 5.27005L14.75 5.20005L18 2.05005L21.25 5.20005L25.78 5.27005L25.85 9.80005L29 13.05Z" fill="currentColor"></path></svg>`;

const SAMPLE_ACHIEVEMENT_IMAGE = "https://shared.steamstatic.com/community_assets/images/apps/22380/ee1e9636c2b7d5add9123ef556c80fdd87ba1669.jpg";

const CONSTELLATION_PATH_D = "M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688Z";

const CONSTELLATIONS: { top: string; left: string; width: string; opacity: number }[] = [
  { top: "15.63%", left: "12.5%",  width: "8px",  opacity: 0.7 },
  { top: "62.5%",  left: "36.11%", width: "6px",  opacity: 0.4 },
  { top: "26.04%", left: "58.33%", width: "10px", opacity: 0.8 },
  { top: "67.71%", left: "80.56%", width: "7px",  opacity: 0.5 },
];

function ConstellationHalf() {
  return (
    <div className="ac-drift-half">
      {CONSTELLATIONS.map((c, i) => (
        <svg
          key={i}
          className="ac-constellation-path"
          viewBox="133 0 8 9"
          style={{ top: c.top, left: c.left, width: c.width, opacity: c.opacity }}
        >
          <path d={CONSTELLATION_PATH_D} />
        </svg>
      ))}
    </div>
  );
}

// data-ac-react marks these clips as React-owned: the notification webview's
// teardown sweeps loose .ac-sky-clip nodes, and must not rip out nodes React
// still holds a reference to.
function SkyDecorations({ variant }: { variant: DecorationVariant }) {
  if (variant === "sparkles") {
    return (
      <div className="ac-sky-clip" data-ac-react="1">
        {SPARKLES.map((_, i) => (
          <div key={i} className={`ac-sparkle ac-sparkle-${i + 1}`} />
        ))}
      </div>
    );
  }

  if (variant === "sky-day") {
    return (
      <div className="ac-sky-clip" data-ac-react="1">
        <div className="ac-sun" />
        <svg className="ac-birds" viewBox="0 0 60 20" width="40" height="20">
          <path d="M2 10 Q 7 2 12 10 Q 17 2 22 10" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 15 Q 30 7 35 15 Q 40 7 45 15" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="ac-drift-wrapper">
          <div className="ac-drift-track ac-drift-back-clouds">
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
          </div>
        </div>
        <div className="ac-drift-wrapper">
          <div className="ac-drift-track ac-drift-front-clouds">
            <div className="ac-drift-half">
              <div className="ac-cloud-1" />
              <div className="ac-cloud-2" />
            </div>
            <div className="ac-drift-half">
              <div className="ac-cloud-1" />
              <div className="ac-cloud-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-sky-clip" data-ac-react="1">
      <div className="ac-moon" />
      <div className="ac-star ac-star-1" />
      <div className="ac-star ac-star-2" />
      <div className="ac-star ac-star-3" />
      <div className="ac-star ac-star-4" />
      <div className="ac-star ac-star-5" />
      <div className="ac-star ac-star-6" />
      <div className="ac-star ac-star-7" />
      <div className="ac-star ac-star-8" />
      <div className="ac-star ac-star-9" />
      <div className="ac-star ac-star-10" />
      <div className="ac-star ac-star-11" />
      <div className="ac-star ac-star-12" />
      <div className="ac-star ac-star-13" />
      <div className="ac-star ac-star-14" />
      <div className="ac-star ac-star-15" />
      <div className="ac-star ac-star-16" />
      <div className="ac-drift-wrapper">
        <div className="ac-drift-track ac-drift-stars">
          <ConstellationHalf />
          <ConstellationHalf />
        </div>
      </div>
    </div>
  );
}

// Mounts the decoration overlay as a direct child of the toast card.
//
// Toast content can only be handed to Steam through the logo/title/body slots,
// and the logo slot is a fixed 44px box — an inset:0 overlay rendered there
// covers the icon, not the card. So this renders a zero-size marker in the logo
// slot, walks up to the card, and portals the overlay in as the card's first
// child. That is the same structure the native-toast DOM injection produces.
function ToastDecorations({ variant }: { variant: DecorationVariant }) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Retried across a few frames: the class lands on the toast root in the same
    // commit as this marker, but Steam's toast shell has a history of mounting
    // in more than one pass, and a miss here means no decoration at all.
    let frame = 0;
    let raf = 0;
    const look = () => {
      const found = markerRef.current?.closest<HTMLElement>(".achievement-customizer-toast");
      if (found) {
        setCard(found);
      } else if (++frame < 4) {
        raf = requestAnimationFrame(look);
      }
    };
    look();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} />
      {card ? createPortal(<SkyDecorations variant={variant} />, card) : null}
    </>
  );
}

function BadgeIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <span
      style={{ color, width: `${size}px`, height: `${size}px`, display: "inline-flex", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: ACHIEVEMENT_BADGE_SVG }}
    />
  );
}

function AchievementToastMock({
  settings,
  name,
  description,
  imageUrl,
}: {
  settings: ThemeSettings;
  name: string;
  description: string;
  imageUrl: string;
}) {
  const s = sanitizeSettings(settings);
  const accent = s.accentColor;
  const ir = iconRadius(s.iconShape);
  const decoration = activeDecoration(s);

  const bg =
    s.bannerStyle === "glass"
      ? { background: `${s.primaryColor}cc`, backdropFilter: "blur(10px)" }
      : s.bannerStyle === "solid"
        ? { background: s.primaryColor }
        : { background: `linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor})` };

  // Carries the real toast class + generated CSS so the preview plays the actual
  // entrance, shine and decoration animations rather than approximating them.
  // Inline styles stay as a fallback for when the class rules are absent.
  return (
    <div
      className="achievement-customizer-toast"
      style={{
        ...bg,
        border: `2px solid ${accent}`,
        borderRadius: `${s.borderRadius}px`,
        boxShadow: s.glowEnabled
          ? `0 0 ${s.glowIntensity}px ${accent}88, 0 0 ${s.glowIntensity * 3}px ${accent}44`
          : "none",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxSizing: "border-box",
        minHeight: "64px",
      }}
    >
      <style>{buildToastCSS(s)}</style>
      {decoration && <SkyDecorations variant={decoration} />}
      <img
        src={imageUrl}
        style={{
          width: "44px",
          height: "44px",
          borderRadius: ir,
          border: s.iconBorder ? `2px solid ${accent}` : "none",
          boxShadow: s.iconBorder ? `0 0 8px ${accent}66` : "none",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
      <div
        className="achievement-customizer-content"
        style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" as const, minWidth: 0, gap: "3px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <BadgeIcon color={accent} size={18} />
          <span
            style={{
              color: s.textColor,
              fontWeight: "bold",
              fontSize: "14px",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {name}
          </span>
        </div>
        <div
          style={{
            color: s.descColor,
            fontSize: "12px",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            paddingLeft: "24px",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

function fireXboxToast(name: string, description: string, imageUrl: string, globalPct?: number): void {
  const s = sanitizeSettings(currentSettings);
  const rarity = getRarityOverride(globalPct ?? -1, s.rarityEffects);
  const accent = rarity?.accentColor || s.accentColor;
  const ir = iconRadius(s.iconShape);

  // The badge goes through the toast `icon` slot (Steam's Header > Icon)
  // instead of being embedded in the title node — that keeps the native DOM
  // shape so the body-indent CSS aligns title text and description.
  const titleTextStyle: CSSProperties = {
    color: s.textColor,
    fontWeight: "bold",
    fontSize: "14px",
    lineHeight: 1.25,
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const titleContent = rarity?.titlePrefix ? (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          color: accent,
          fontSize: "10px",
          fontWeight: "bold",
          letterSpacing: "1px",
          marginBottom: "2px",
        }}
      >
        {rarity.titlePrefix}
      </div>
      <span style={titleTextStyle}>{name}</span>
    </div>
  ) : (
    <span style={titleTextStyle}>{name}</span>
  );

  const skyVariant = activeDecoration(s);

  toaster.toast({
    logo: (
      <>
        <style>{buildToastCSS(s, rarity)}</style>
        {skyVariant && <ToastDecorations variant={skyVariant} />}
        <img
          src={imageUrl}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: ir,
            border: s.iconBorder ? `2px solid ${accent}` : "none",
            boxShadow: s.iconBorder ? `0 0 8px ${accent}66` : "none",
            objectFit: "cover",
          }}
        />
      </>
    ),
    icon: <BadgeIcon color={accent} size={18} />,
    title: titleContent,
    body: <span style={{ color: s.descColor, fontSize: "12px" }}>{description}</span>,
    className: "achievement-customizer-toast",
    contentClassName: "achievement-customizer-content",
    duration: s.duration,
    playSound: true,
    showToast: true,
  });
}

// Regression-test toasts mirroring the native variants that share Steam's
// toast shell. Long strings on purpose: titles must ellipsize on one line and
// bodies must clamp to two, on device, for every variant.
// Do NOT set eType on synthetic toasts: non-General types make Steam's
// NotificationStore expect real protobuf notification data and can jam the
// whole toast queue (native toasts included) when it is missing.
type SampleToastVariant = "download" | "friend-online" | "now-playing";

const SAMPLE_AVATAR_IMAGE = "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";

const SAMPLE_TOASTS: Record<SampleToastVariant, { title: string; body: string; image: string }> = {
  download: {
    title: "Download Complete",
    body: "The Elder Scrolls V: Skyrim Anniversary Edition - Ultra HD Texture Pack",
    image: SAMPLE_ACHIEVEMENT_IMAGE,
  },
  "friend-online": {
    title: "Christopher Alexander Montgomery-Featherstone III",
    body: "is now online",
    image: SAMPLE_AVATAR_IMAGE,
  },
  "now-playing": {
    title: "Christopher Alexander Montgomery-Featherstone III",
    body: "is now playing Cyberpunk 2077: Phantom Liberty Collector's Edition Deluxe",
    image: SAMPLE_AVATAR_IMAGE,
  },
};

function fireSampleToast(variant: SampleToastVariant): void {
  const s = sanitizeSettings(currentSettings);
  const sample = SAMPLE_TOASTS[variant];
  const skyVariant = activeDecoration(s);

  toaster.toast({
    logo: (
      <>
        <style>{buildToastCSS(s)}</style>
        {skyVariant && <ToastDecorations variant={skyVariant} />}
        <img
          src={sample.image}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: iconRadius(s.iconShape),
            border: s.iconBorder ? `2px solid ${s.accentColor}` : "none",
            boxShadow: s.iconBorder ? `0 0 8px ${s.accentColor}66` : "none",
            objectFit: "cover",
          }}
        />
      </>
    ),
    title: (
      <span
        style={{
          color: s.textColor,
          fontWeight: "bold",
          fontSize: "14px",
          lineHeight: 1.25,
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {sample.title}
      </span>
    ),
    body: <span style={{ color: s.descColor, fontSize: "12px" }}>{sample.body}</span>,
    className: "achievement-customizer-toast",
    contentClassName: "achievement-customizer-content",
    duration: s.duration,
    playSound: true,
    showToast: true,
  });
}

function extractAchievement(notification: AchievementNotification): MaybeAchievement | null {
  return (
    notification?.achievement?.vecHighlight?.[0] ??
    notification?.achievement?.vecAchievedHidden?.[0] ??
    notification?.achievement?.rgAchievements?.[0] ??
    notification?.vecHighlight?.[0] ??
    notification?.vecAchievedHidden?.[0] ??
    null
  );
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslStringToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
  if (!match) return hsl;

  const h = parseInt(match[1], 10) / 360;
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number): string => Math.round(c * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ColorButton({
  color,
  label,
  onChange,
}: {
  color: string;
  label: string;
  onChange: (c: string) => void;
}) {
  const hsl = hexToHSL(color);

  return (
    <ButtonItem
      layout="below"
      onClick={() => {
        showModal(
          <ColorPickerModal
            title={label}
            defaultH={hsl.h}
            defaultS={hsl.s}
            defaultL={hsl.l}
            onConfirm={(hslStr) => onChange(hslStringToHex(hslStr))}
            closeModal={() => {}}
          />,
        );
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: color,
            border: "1px solid rgba(255,255,255,0.3)",
            flexShrink: 0,
          }}
        />
        <span>{label}</span>
      </div>
    </ButtonItem>
  );
}

function ThemePreview({ settings }: { settings: ThemeSettings }) {
  // Keying on the settings remounts the card whenever anything changes, which
  // replays the one-shot entrance and shine animations so the user sees the
  // effect they just picked instead of only its resting state.
  return (
    <AchievementToastMock
      key={JSON.stringify(settings)}
      settings={settings}
      name="Achievement Unlocked"
      description="Preview of your theme"
      imageUrl={SAMPLE_ACHIEVEMENT_IMAGE}
    />
  );
}

function Content() {
  const [settings, setSettings] = useState<ThemeSettings>(currentSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        currentSettings = s;
        setLoaded(true);
      })
      .catch((error) => {
        console.error("[AchievementCustomizer] Failed to load settings", error);
        setLoaded(true);
      });
  }, []);

  const update = (partial: Partial<ThemeSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    currentSettings = next;
    saveSettingsSafe(next);
    reinjectAllCSS(next);
  };

  const applyPreset = (preset: string) => {
    if (preset === "custom") {
      update({ preset: "custom" });
      return;
    }

    const selected = PRESETS[preset];
    if (selected) {
      update({ preset, ...selected });
    }
  };

  if (!loaded) return null;

  return (
    <>
      <PanelSection title="Preview">
        <PanelSectionRow>
          <ThemePreview settings={settings} />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Test Toasts">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Long title and description to verify truncation"
            onClick={() =>
              fireXboxToast(
                "Master of the Entirely Unnecessary Grind: Platinum Edition",
                "Unlock every single collectible scattered across all nine regions of the map without fast travel",
                SAMPLE_ACHIEVEMENT_IMAGE,
              )
            }
          >
            Achievement
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Rarity effect, under 10% of players"
            onClick={() => fireXboxToast("Sharpshooter", "Only 5% of players unlocked this!", SAMPLE_ACHIEVEMENT_IMAGE, 5)}
          >
            Rare
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Rarity effect, under 1% of players"
            onClick={() => fireXboxToast("Diamond Hands", "Less than 1% of players unlocked this!", SAMPLE_ACHIEVEMENT_IMAGE, 0.5)}
          >
            Ultra Rare
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Long game name in the body line"
            onClick={() => fireSampleToast("download")}
          >
            Download Complete
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Long friend name in the title line"
            onClick={() => fireSampleToast("friend-online")}
          >
            Friend Online
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            description="Long friend name plus long game title"
            onClick={() => fireSampleToast("now-playing")}
          >
            Now Playing
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* AC-PROBE (temporary diagnostic section — remove with the probe block) */}
      <PanelSection title="Diagnostics">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              // Fire a toast, then probe it while it is still on screen. Gives a
              // baseline to diff the real-unlock probe against.
              fireXboxToast("Probe Toast", "Characterizing the live toast DOM for the native render path.", SAMPLE_ACHIEVEMENT_IMAGE, -1);
              [400, 1500].forEach((d) => setTimeout(() => runToastProbe(`[testbtn+${d}ms]`), d));
            }}
          >
            Probe Test Toast DOM
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => runToastProbe("[idle]")}>
            Probe Idle (no toast)
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Theme">
        <PanelSectionRow>
          <DropdownItem
            label="Preset"
            rgOptions={PRESET_OPTIONS}
            selectedOption={settings.preset}
            onChange={(opt) => applyPreset(opt.data)}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Colors">
        <PanelSectionRow>
          <ColorButton color={settings.primaryColor} label="Primary" onChange={(c) => update({ primaryColor: c, preset: "custom" })} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton color={settings.secondaryColor} label="Secondary" onChange={(c) => update({ secondaryColor: c, preset: "custom" })} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton color={settings.accentColor} label="Accent / Glow" onChange={(c) => update({ accentColor: c, preset: "custom" })} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton color={settings.textColor} label="Title Text" onChange={(c) => update({ textColor: c, preset: "custom" })} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton color={settings.descColor} label="Description Text" onChange={(c) => update({ descColor: c, preset: "custom" })} />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Style">
        <PanelSectionRow>
          <DropdownItem
            label="Banner Style"
            rgOptions={BANNER_STYLE_OPTIONS}
            selectedOption={settings.bannerStyle}
            onChange={(opt) => update({ bannerStyle: opt.data })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Icon Shape"
            rgOptions={ICON_SHAPE_OPTIONS}
            selectedOption={settings.iconShape}
            onChange={(opt) => update({ iconShape: opt.data })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField label="Icon Border" checked={settings.iconBorder} onChange={(v) => update({ iconBorder: v })} />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Toast Shape"
            rgOptions={TOAST_SHAPE_OPTIONS}
            selectedOption={TOAST_SHAPE_OPTIONS.find((o) => o.data === settings.borderRadius)?.data ?? 8}
            onChange={(opt) => update({ borderRadius: opt.data })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Decorations"
            description="Animated sky overlay behind toast text"
            rgOptions={DECORATION_OPTIONS}
            selectedOption={settings.decorativeElements}
            onChange={(opt) => update({ decorativeElements: opt.data })}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Effects">
        <PanelSectionRow>
          <ToggleField label="Entrance Animation" description="Animate the toast as it appears" checked={settings.popupAnimation} onChange={(v) => update({ popupAnimation: v })} />
        </PanelSectionRow>
        {settings.popupAnimation && (
          <PanelSectionRow>
            <DropdownItem
              label="Entrance Style"
              rgOptions={ENTRANCE_OPTIONS}
              selectedOption={safeEntrance(settings.entranceStyle as string)}
              onChange={(opt) => update({ entranceStyle: opt.data })}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Shine Sweep"
            description="Light sweeps across the toast once on arrival"
            checked={settings.shineEnabled}
            onChange={(v) => update({ shineEnabled: v })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField label="Glow Effect" checked={settings.glowEnabled} onChange={(v) => update({ glowEnabled: v })} />
        </PanelSectionRow>
        {settings.glowEnabled && (
          <PanelSectionRow>
            <SliderField
              label="Glow Intensity"
              value={settings.glowIntensity}
              min={5}
              max={50}
              step={5}
              onChange={(v) => update({ glowIntensity: v })}
              showValue
              valueSuffix="px"
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Rarity Effects"
            description="Gold glow for rare, diamond for ultra rare"
            checked={settings.rarityEffects}
            onChange={(v) => update({ rarityEffects: v })}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Timing">
        <PanelSectionRow>
          <SliderField
            label="Display Duration"
            value={settings.duration / 1000}
            min={3}
            max={15}
            step={1}
            onChange={(v) => update({ duration: v * 1000 })}
            showValue
            valueSuffix="s"
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Reset">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              getDefaultSettings().then((defaults) => {
                setSettings(defaults);
                currentSettings = defaults;
                saveSettingsSafe(defaults);
                reinjectAllCSS(defaults);
              });
            }}
          >
            Reset to Default
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  getSettings()
    .then((settings) => {
      currentSettings = settings;
      reinjectAllCSS(settings);
    })
    .catch(() => {
      reinjectAllCSS(currentSettings);
    });

  const steamClient = (globalThis as typeof globalThis & { SteamClient?: SteamClientShape }).SteamClient;
  let unregister: RegisterHandle | undefined;
  let reinjectionInterval: ReturnType<typeof setInterval> | undefined;

  // Re-inject periodically so a game-switch that resets the notification webview
  // (new UID, clean JS context) gets the styles and poll loop back. injectNotifCSS
  // is a no-op when the generation already matches, so this never disturbs
  // running animations — that guard is what allows an interval at all.
  reinjectionInterval = setInterval(() => injectNotifCSS(currentSettings), 3000);

  const register = steamClient?.GameSessions?.RegisterForAchievementNotification;
  if (typeof register === "function") {
    try {
      unregister = register((notification) => {
        // The callback runs inside Steam's notification dispatch: any
        // exception escaping here can suppress the native toast too.
        try {
          const achieved = extractAchievement(notification);

          if (!achieved) {
            console.warn("[AchievementCustomizer] Unrecognized achievement notification payload", notification);
            return;
          }

          // Re-inject CSS on every achievement (handles UID tab rotation).
          // Both sky variants inject decoration DOM; retry at 0 ms and 100 ms
          // so elements appear even if the webview was just reset.
          injectNotifCSS(currentSettings);

          const skyElem = activeDecoration(currentSettings);
          if (skyElem) {
            const snippet = buildSkyInjectionSnippet(skyElem);
            [0, 100].forEach((delay) => {
              setTimeout(() => {
                for (const tab of NOTIF_TAB_NAMES) {
                  executeInTab(tab, false, snippet).catch(() => {});
                }
              }, delay);
            });
          }

          fireXboxToast(
            achieved.strName ?? achieved.strDisplayName ?? "Achievement Unlocked",
            achieved.strDescription ?? achieved.strDesc ?? "",
            achieved.strImage ?? achieved.strIcon ?? SAMPLE_ACHIEVEMENT_IMAGE,
            typeof achieved.flAchieved === "number" ? achieved.flAchieved : -1,
          );

          // AC-PROBE (temporary): dump the raw notification payload plus the
          // live DOM at two points while the toast is still on screen. The
          // payload dump settles whether any global-percentage field exists
          // for rarity; flAchieved is currently assumed to be one and is not.
          try {
            debugLog(`[unlock] payload=${JSON.stringify(notification).slice(0, 1800)}`).catch(() => {});
          } catch {
            debugLog("[unlock] payload not serializable").catch(() => {});
          }
          [400, 1500].forEach((delay) => {
            setTimeout(() => runToastProbe(`[unlock+${delay}ms]`), delay);
          });
        } catch (e) {
          console.error("[AchievementCustomizer] achievement handler failed:", e);
        }
      });
    } catch (e) {
      console.warn("[AchievementCustomizer] RegisterForAchievementNotification failed:", e);
    }
  } else {
    console.warn("[AchievementCustomizer] RegisterForAchievementNotification is unavailable");
  }

  return {
    name: "Achievement Customizer",
    titleView: <div className={staticClasses.Title}>Achievement Customizer</div>,
    content: <Content />,
    icon: <FaPalette />,
    onDismount() {
      if (reinjectionInterval) clearInterval(reinjectionInterval);
      unregister?.unregister?.();
      if (currentPageCssId) {
        removeCssFromTab("Steam Big Picture Mode", currentPageCssId);
      }
      // __acSkyGen must be cleared too: a reload with identical settings would
      // otherwise match the stale generation and skip re-setup entirely, leaving
      // the webview with no styles and no decorations.
      const cleanup = `(function(){var el=document.getElementById("achievement-customizer-notif-css");if(el)el.remove();if(window.__acSkyObs){window.__acSkyObs.disconnect();window.__acSkyObs=null;}if(window.__acSkyPoll){clearInterval(window.__acSkyPoll);window.__acSkyPoll=null;}window.__acSkyGen=null;document.querySelectorAll(".ac-sky-clip").forEach(function(e){e.remove();});})();`;
      for (const tab of NOTIF_TAB_NAMES) {
        executeInTab(tab, false, cleanup).catch(() => {});
      }
    },
  };
});
