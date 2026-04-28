import {
  ButtonItem,
  ColorPickerModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
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
import { useEffect, useState } from "react";
import { FaPalette } from "react-icons/fa";

const getSettings = callable<[], ThemeSettings>("get_settings");
const saveSettings = callable<[settings: ThemeSettings], boolean>("save_settings");
const getDefaultSettings = callable<[], ThemeSettings>("get_default_settings");

type PresetName = "xbox" | "playstation" | "steam" | "nintendo" | "gold" | "midnight" | "sky-night" | "custom";
type IconShape = "circle" | "rounded" | "square";
type BannerStyle = "gradient" | "solid" | "glass";
type DecorativeElements = "none" | "sky-night";

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
  showCustomToastOnRealUnlock: boolean;
  popupAnimation: boolean;
  decorativeElements: DecorativeElements | string;
}

interface RarityOverride {
  label: string;
  accentColor: string;
  extraCSS: string;
  titlePrefix: string;
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "none",
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
    showCustomToastOnRealUnlock: true,
    popupAnimation: true,
    decorativeElements: "sky-night",
  },
};

const PRESET_OPTIONS = [
  { data: "xbox", label: "Xbox" },
  { data: "playstation", label: "PlayStation" },
  { data: "steam", label: "Steam" },
  { data: "nintendo", label: "Nintendo" },
  { data: "gold", label: "Gold" },
  { data: "midnight", label: "Midnight" },
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

function buildAchievementPageCSS(s: ThemeSettings): string {
  const ir = iconRadius(s.iconShape);
  const glowRgba = `${s.accentColor}66`;
  const glowRgbaStrong = `${s.accentColor}99`;

  return `
    ._2Kmn7fJOkLT4KyWl467a9M {
      ${bannerBgCSS(s)}
      border: 1px solid ${s.accentColor}4d !important;
      border-radius: ${s.borderRadius}px !important;
      margin-bottom: 8px !important;
      transition: all 0.3s ease !important;
    }
    ._2Kmn7fJOkLT4KyWl467a9M:hover {
      border-color: ${s.accentColor} !important;
      box-shadow: 0 0 15px ${glowRgba} !important;
      transform: scale(1.02) !important;
    }
    ._1fEbX-PfpZ2FhkhttWcm-V {
      border-radius: ${ir} !important;
      box-shadow: 0 0 12px ${glowRgba} !important;
      border: 2px solid ${s.accentColor} !important;
      overflow: hidden !important;
    }
    ._2V2sHETNfa62yMoDwSF3_t {
      border-radius: ${ir} !important;
    }
    .k02sevxj1a1YpBto7_V57 {
      color: ${s.accentColor} !important;
      font-weight: bold !important;
    }
    @keyframes xbox-glow-pulse {
      0% { box-shadow: 0 0 5px ${glowRgba}; }
      50% { box-shadow: 0 0 20px ${glowRgbaStrong}, 0 0 40px ${glowRgba}; }
      100% { box-shadow: 0 0 5px ${glowRgba}; }
    }
    ._2Kmn7fJOkLT4KyWl467a9M:has(.k02sevxj1a1YpBto7_V57) {
      animation: xbox-glow-pulse 3s ease-in-out infinite !important;
      ${bannerBgCSS(s)}
      border-color: ${s.accentColor} !important;
    }
  `;
}

function buildSkyCSS(_variant: "sky-night"): string {
  const gradient = "linear-gradient(160deg, #2A2D3E 0%, #1D1F2C 100%)";

  const common = `
    .achievement-customizer-toast {
      position: relative !important;
      background: ${gradient} !important;
    }
    .achievement-customizer-content {
      position: static !important;
    }
    .achievement-customizer-content > *:not(:has(.ac-sky-clip)) {
      position: relative !important;
      z-index: 1 !important;
    }

    .ac-sky-clip {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
      border-radius: inherit;
    }

    .ac-sky-clip ~ img {
      position: relative !important;
      z-index: 1 !important;
    }

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
    .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }

    @keyframes ac-drift-left {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ac-moon, .ac-star, .ac-drift-stars {
        animation: none !important;
      }
    }
  `;

  return `${common}
    .ac-moon {
      position: absolute;
      top: 14.58%;
      right: 6.11%;
      width: 34px; height: 34px;
      background: #C4C9D1;
      border-radius: 50%;
      box-shadow:
        inset 1px 1px 2px rgba(254, 255, 239, 0.5),
        inset 0 -1px 2px rgba(150, 150, 150, 0.6);
      animation: ac-moon-pulse 5s infinite ease-in-out;
    }
    .ac-moon::after {
      content: '';
      position: absolute;
      top: -3px; right: -8px;
      width: 34px; height: 34px;
      border-radius: 50%;
      background: #2A2D3E;
    }
    @keyframes ac-moon-pulse {
      0%, 100% { filter: drop-shadow(0 0 10px rgba(196, 201, 209, 0.25)); }
      50%      { filter: drop-shadow(0 0 10px rgba(196, 201, 209, 0.45)); }
    }

    .ac-star {
      position: absolute;
      background: #fff;
      border-radius: 50%;
      animation: ac-twinkle 2.5s infinite ease-in-out alternate;
    }
    .ac-star-1 { width: 2px; height: 2px; top: 18.75%; left: 38.89%; animation-delay: 0s; }
    .ac-star-2 { width: 3px; height: 3px; top: 36.46%; left: 66.67%; animation-delay: 0.3s; }
    .ac-star-3 { width: 2px; height: 2px; top: 72.92%; left: 30.56%; animation-delay: 0.7s; }
    .ac-star-4 { width: 4px; height: 4px; top: 22.92%; left: 16.67%; animation-delay: 1.2s; }
    .ac-star-5 { width: 2px; height: 2px; top: 57.29%; left: 86.11%; animation-delay: 1.8s; }
    .ac-star-6 { width: 3px; height: 3px; top: 83.33%; left: 52.78%; animation-delay: 0.5s; }
    .ac-star-7 { width: 2px; height: 2px; top: 46.88%; left: 5.56%; animation-delay: 1.5s; }
    .ac-star-8 { width: 2px; height: 2px; top: 67.71%; left: 75.00%; animation-delay: 0.9s; }

    @keyframes ac-twinkle {
      0%   { opacity: 0.4; }
      100% { opacity: 1.0; }
    }

    .ac-constellation-path {
      position: absolute;
      fill: #fff;
    }
  `;
}

function buildToastCSS(s: ThemeSettings, rarity?: RarityOverride | null): string {
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

  const popupCSS = buildPopupAnimationCSS(s, "toast-enter");

  const skyCSS = s.decorativeElements === "sky-night" ? buildSkyCSS("sky-night") : "";

  return `
    ${popupCSS}

    .achievement-customizer-toast {
      overflow: visible !important;
      ${bg}
      border: 2px solid ${accent} !important;
      border-radius: ${s.borderRadius}px !important;
      ${glow}
      padding: 10px 14px !important;
      ${s.popupAnimation ? "animation: toast-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;" : ""}
    }

    .achievement-customizer-toast > div {
      background: transparent !important;
    }

    .achievement-customizer-toast img {
      border-radius: ${iconRadius(s.iconShape)} !important;
      border: ${s.iconBorder ? `2px solid ${accent}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${accent}66` : "none"} !important;
    }

    ${rarity?.extraCSS || ""}
    ${skyCSS}
  `;
}

let currentSettings: ThemeSettings = { preset: "xbox", ...PRESETS.xbox };
let currentPageCssId: string | null = null;

function buildPopupAnimationCSS(s: ThemeSettings, keyframeName: string): string {
  if (!s.popupAnimation) return "";

  return `
    @keyframes ${keyframeName} {
      0% { opacity: 0; transform: scale(0.3); border-radius: 50%; }
      40% { opacity: 1; transform: scale(1.05); border-radius: ${s.borderRadius * 2}px; }
      70% { transform: scale(0.97); border-radius: ${s.borderRadius}px; }
      100% { opacity: 1; transform: scale(1); border-radius: ${s.borderRadius}px; }
    }
  `;
}

function buildNativeToastCSS(s: ThemeSettings): string {
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

  const popupCSS = buildPopupAnimationCSS(s, "toast-enter-native");

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
    }

    div[role="alert"] > .Panel,
    div[role="alert"] > .Panel.Focusable,
    div[role="alert"] > [role="button"],
    div[role="alert"] .Panel,
    div[role="alert"] [role="button"] {
      ${bg}
      border: 2px solid ${s.accentColor} !important;
      border-radius: ${s.borderRadius}px !important;
      padding: 10px 14px !important;
      ${glow}
      ${s.popupAnimation ? "animation: toast-enter-native 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;" : ""}
    }

    .Panel ._1fEbX-PfpZ2FhkhttWcm-V {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      border-radius: ${ir} !important;
      overflow: hidden !important;
      border: ${s.iconBorder ? `2px solid ${s.accentColor}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${s.accentColor}66` : "none"} !important;
    }

    .Panel ._2V2sHETNfa62yMoDwSF3_t {
      border-radius: ${ir} !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }

    .Panel ._18PwvOcpWfW3M8j2-bEPPJ {
      color: ${s.textColor} !important;
      font-weight: bold !important;
      font-size: 14px !important;
    }

    .Panel ._2jpxEWvo06efD6-NR1cplA {
      color: ${s.descColor} !important;
      font-size: 12px !important;
      padding-top: 4px !important;
      padding-left: 24px !important;
    }

    .Panel ._2F0wqsu2mqsHxBSJcu1sPJ,
    .Panel ._2F0wqsu2mqsHxBSJcu1sPJ svg {
      color: ${s.accentColor} !important;
      fill: currentColor !important;
      width: 18px !important;
      height: 18px !important;
    }

    ${buildNativeSkyCSS(s.decorativeElements)}
  `;
}

// Native overlay is CSS-only (executeInTab can't add DOM). Sky presets get a
// degraded fallback here: gradient background + a single sun/moon pseudo-element
// with pulse. Drift clouds, birds, stars, and constellations are not possible
// without DOM injection and are intentionally omitted on this surface.
function buildNativeSkyCSS(variant: "sky-night" | string | undefined): string {
  if (variant !== "sky-night") return "";
  const root = '[role="alert"],[class*="Toast"][class*="Root"],._3YTh805w3-xgPkHE_22XcA';
  const child = '[role="alert"]>div,[class*="Toast"][class*="Root"]>div,._3YTh805w3-xgPkHE_22XcA>div';
  return `${root}{background:linear-gradient(160deg,#2A2D3E 0%,#1D1F2C 100%)!important;position:relative!important;overflow:hidden!important;isolation:isolate!important;}${child}{background:transparent!important;position:relative!important;z-index:0!important;}${root}::before{content:'';position:absolute;top:12px;right:20px;width:34px;height:34px;background:#C4C9D1;border-radius:50%;box-shadow:inset 1px 1px 2px rgba(254,255,239,0.5),inset 0 -1px 2px rgba(150,150,150,0.6),0 0 14px rgba(196,201,209,0.35);pointer-events:none;}${root}::after{content:'';position:absolute;top:9px;right:12px;width:34px;height:34px;background:#2A2D3E;border-radius:50%;pointer-events:none;}${child}::before{content:'';position:absolute;top:0;left:0;width:2px;height:2px;background:transparent;box-shadow:20px 8px 0 0 #fff,50px 18px 0 0 #fff,80px 30px 0 0 #fff,110px 12px 0 0 #fff,140px 25px 0 0 #fff,170px 8px 0 0 #fff,200px 32px 0 0 #fff,230px 15px 0 0 #fff,260px 42px 0 0 #fff,290px 20px 0 0 #fff,40px 50px 0 0 #fff,70px 52px 0 0 #fff,100px 55px 0 0 #fff,130px 58px 0 0 #fff,180px 48px 0 0 #fff,250px 50px 0 0 #fff;animation:ac-nt-1 2.4s ease-in-out infinite;will-change:opacity;pointer-events:none;z-index:-1;}${child}::after{content:'';position:absolute;top:0;left:0;width:2px;height:2px;background:transparent;box-shadow:35px 22px 0 0 #fff,65px 10px 0 0 #fff,95px 35px 0 0 #fff,125px 20px 0 0 #fff,155px 45px 0 0 #fff,185px 14px 0 0 #fff,215px 30px 0 0 #fff,245px 6px 0 0 #fff,275px 38px 0 0 #fff,305px 22px 0 0 #fff,15px 42px 0 0 #fff,45px 48px 0 0 #fff,85px 52px 0 0 #fff,120px 54px 0 0 #fff,155px 56px 0 0 #fff,220px 52px 0 0 #fff;animation:ac-nt-2 3.7s ease-in-out -1.8s infinite;will-change:opacity;pointer-events:none;z-index:-1;}@keyframes ac-nt-1{0%,100%{opacity:.25}50%{opacity:1}}@keyframes ac-nt-2{0%,100%{opacity:.3}50%{opacity:.95}}@media (prefers-reduced-motion: reduce){[role="alert"]::before,[role="alert"]::after,[role="alert"]>div::before,[role="alert"]>div::after{animation:none!important}}`;
}

function injectNotifCSS(s: ThemeSettings): void {
  const css = buildNativeToastCSS(s);
  const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  executeInTab("notificationtoasts_uid2", false, `
    (function() {
      var el = document.getElementById("achievement-customizer-notif-css");
      if (el) el.remove();
      var style = document.createElement("style");
      style.id = "achievement-customizer-notif-css";
      style.textContent = \`${escaped}\`;
      document.head.appendChild(style);
    })();
  `).catch(() => {});
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
  // Retry in case the notification tab isn't ready yet at startup
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

function SkyDecorations({ variant: _variant }: { variant: "sky-night" }) {
  return (
    <div className="ac-sky-clip">
      <div className="ac-moon" />
      <div className="ac-star ac-star-1" />
      <div className="ac-star ac-star-2" />
      <div className="ac-star ac-star-3" />
      <div className="ac-star ac-star-4" />
      <div className="ac-star ac-star-5" />
      <div className="ac-star ac-star-6" />
      <div className="ac-star ac-star-7" />
      <div className="ac-star ac-star-8" />
      <div className="ac-drift-wrapper">
        <div className="ac-drift-track ac-drift-stars">
          <ConstellationHalf />
          <ConstellationHalf />
        </div>
      </div>
    </div>
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
  const accent = settings.accentColor;
  const ir = iconRadius(settings.iconShape);

  const bg =
    settings.bannerStyle === "glass"
      ? { background: `${settings.primaryColor}cc`, backdropFilter: "blur(10px)" }
      : settings.bannerStyle === "solid"
        ? { background: settings.primaryColor }
        : { background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` };

  return (
    <div
      style={{
        ...bg,
        border: `2px solid ${accent}`,
        borderRadius: `${settings.borderRadius}px`,
        boxShadow: settings.glowEnabled
          ? `0 0 ${settings.glowIntensity}px ${accent}88, 0 0 ${settings.glowIntensity * 3}px ${accent}44`
          : "none",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <img
        src={imageUrl}
        style={{
          width: "44px",
          height: "44px",
          borderRadius: ir,
          border: settings.iconBorder ? `2px solid ${accent}` : "none",
          boxShadow: settings.iconBorder ? `0 0 8px ${accent}66` : "none",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" as const, minWidth: 0, gap: "3px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BadgeIcon color={accent} size={18} />
          <span style={{ color: settings.textColor, fontWeight: "bold", fontSize: "14px" }}>{name}</span>
        </div>
        <div style={{ color: settings.descColor, fontSize: "12px" }}>{description}</div>
      </div>
    </div>
  );
}

function fireXboxToast(name: string, description: string, imageUrl: string, globalPct?: number): void {
  const s = currentSettings;
  const rarity = getRarityOverride(globalPct ?? -1, s.rarityEffects);
  const accent = rarity?.accentColor || s.accentColor;
  const ir = iconRadius(s.iconShape);

  const titleRow = (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <BadgeIcon color={accent} size={18} />
      <span style={{ color: s.textColor, fontWeight: "bold", fontSize: "14px" }}>{name}</span>
    </div>
  );

  const titleContent = rarity?.titlePrefix ? (
    <div>
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
      {titleRow}
    </div>
  ) : titleRow;

  const skyVariant = s.decorativeElements === "sky-night" ? "sky-night" : null;

  toaster.toast({
    logo: (
      <>
        <style>{buildToastCSS(s, rarity)}</style>
        {skyVariant && <SkyDecorations variant={skyVariant} />}
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
    title: titleContent,
    body: <span style={{ color: s.descColor, fontSize: "12px" }}>{description}</span>,
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
  return (
    <AchievementToastMock
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
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fireXboxToast("Test Achievement", "You triggered a test notification!", SAMPLE_ACHIEVEMENT_IMAGE)}
          >
            Test Toast
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fireXboxToast("Diamond Hands", "Less than 1% of players unlocked this!", SAMPLE_ACHIEVEMENT_IMAGE, 0.5)}
          >
            Test Ultra Rare
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fireXboxToast("Sharpshooter", "Only 5% of players unlocked this!", SAMPLE_ACHIEVEMENT_IMAGE, 5)}
          >
            Test Rare
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
      </PanelSection>

      <PanelSection title="Effects">
        <PanelSectionRow>
          <ToggleField label="Pop-up Animation" description="Toast pops in from a ball" checked={settings.popupAnimation} onChange={(v) => update({ popupAnimation: v })} />
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
        <PanelSectionRow>
          <ToggleField
            label="Show custom toast on real unlocks"
            description="When off, only the native Steam toast (styled by your chosen preset) shows on real achievements. The test button still shows the custom toast."
            checked={settings.showCustomToastOnRealUnlock}
            onChange={(v) => update({ showCustomToastOnRealUnlock: v })}
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

  const register = steamClient?.GameSessions?.RegisterForAchievementNotification;
  if (typeof register === "function") {
    try {
      unregister = register((notification) => {
        const achieved = extractAchievement(notification);

        if (!achieved) {
          console.warn("[AchievementCustomizer] Unrecognized achievement notification payload", notification);
          return;
        }
        if (!currentSettings.showCustomToastOnRealUnlock) {
          return;
        }

        fireXboxToast(
          achieved.strName ?? achieved.strDisplayName ?? "Achievement Unlocked",
          achieved.strDescription ?? achieved.strDesc ?? "",
          achieved.strImage ?? achieved.strIcon ?? SAMPLE_ACHIEVEMENT_IMAGE,
          typeof achieved.flAchieved === "number" ? achieved.flAchieved : -1,
        );
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
      unregister?.unregister?.();
      if (currentPageCssId) {
        removeCssFromTab("Steam Big Picture Mode", currentPageCssId);
      }
      executeInTab("notificationtoasts_uid2", false, `
        var el = document.getElementById("achievement-customizer-notif-css");
        if (el) el.remove();
      `).catch(() => {});
    },
  };
});
