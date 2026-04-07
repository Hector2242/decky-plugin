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

type PresetName = "xbox" | "playstation" | "steam" | "nintendo" | "gold" | "midnight" | "custom";
type IconShape = "circle" | "rounded" | "square";
type BannerStyle = "gradient" | "solid" | "glass";

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
      accentColor: "#00FFFF",
      titlePrefix: "💎 Ultra Rare!",
      extraCSS: `
        .xbox-achievement-toast {
          border-color: #00FFFF !important;
          box-shadow: 0 0 30px #00FFFF88, 0 0 60px #00FFFF44, 0 0 90px #00FFFF22 !important;
          animation: ultra-rare-glow 1.5s ease-in-out infinite !important;
        }
        @keyframes ultra-rare-glow {
          0% { box-shadow: 0 0 20px #00FFFF66, 0 0 40px #00FFFF33; }
          50% { box-shadow: 0 0 40px #00FFFFaa, 0 0 80px #00FFFF55, 0 0 120px #00FFFF22; }
          100% { box-shadow: 0 0 20px #00FFFF66, 0 0 40px #00FFFF33; }
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
        .xbox-achievement-toast {
          border-color: #FFD700 !important;
          box-shadow: 0 0 20px #FFD70088, 0 0 50px #FFD70044 !important;
          animation: rare-glow 2s ease-in-out infinite !important;
        }
        @keyframes rare-glow {
          0% { box-shadow: 0 0 15px #FFD70055, 0 0 30px #FFD70033; }
          50% { box-shadow: 0 0 30px #FFD70088, 0 0 60px #FFD70044; }
          100% { box-shadow: 0 0 15px #FFD70055, 0 0 30px #FFD70033; }
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
        .xbox-achievement-toast {
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
  },
};

const PRESET_OPTIONS = [
  { data: "xbox", label: "Xbox" },
  { data: "playstation", label: "PlayStation" },
  { data: "steam", label: "Steam" },
  { data: "nintendo", label: "Nintendo" },
  { data: "gold", label: "Gold" },
  { data: "midnight", label: "Midnight" },
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

function buildToastCSS(s: ThemeSettings, rarity?: RarityOverride | null): string {
  const accent = rarity?.accentColor || s.accentColor;
  const glow = s.glowEnabled
    ? `box-shadow: 0 0 ${s.glowIntensity}px ${accent}88, 0 0 ${s.glowIntensity * 3}px ${accent}44 !important;`
    : "";

  const bg =
    s.bannerStyle === "solid"
      ? `background: ${s.primaryColor} !important;`
      : s.bannerStyle === "glass"
        ? `background: ${s.primaryColor}cc !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;`
        : `background: linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor}) !important;`;

  return `
    .xbox-achievement-toast {
      ${bg}
      border: 2px solid ${accent} !important;
      border-radius: ${s.borderRadius}px !important;
      ${glow}
      padding: 8px 10px !important;
    }

    .xbox-achievement-toast > div {
      background: transparent !important;
    }

    .xbox-achievement-toast img {
      border-radius: ${iconRadius(s.iconShape)} !important;
      border: ${s.iconBorder ? `2px solid ${accent}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${accent}66` : "none"} !important;
    }

    ${rarity?.extraCSS || ""}
  `;
}

let currentSettings: ThemeSettings = { preset: "xbox", ...PRESETS.xbox };
let currentPageCssId: string | null = null;

function buildNativeToastCSS(s: ThemeSettings): string {
  const ir = iconRadius(s.iconShape);
  const glow = s.glowEnabled
    ? `box-shadow: 0 0 ${s.glowIntensity}px ${s.accentColor}88, 0 0 ${s.glowIntensity * 3}px ${s.accentColor}44 !important;`
    : "";

  const bg =
    s.bannerStyle === "solid"
      ? `background: ${s.primaryColor} !important;`
      : s.bannerStyle === "glass"
        ? `background: ${s.primaryColor}cc !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;`
        : `background: linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor}) !important;`;

  return `
    div[role="alert"] > .Panel,
    div[role="alert"] > .Panel.Focusable,
    div[role="alert"] > [role="button"] {
      ${bg}
      border: 2px solid ${s.accentColor} !important;
      border-radius: ${s.borderRadius}px !important;
      padding: 10px 14px !important;
      ${glow}
    }

    div[role="alert"] ._1fEbX-PfpZ2FhkhttWcm-V,
    div[role="alert"] ._2V2sHETNfa62yMoDwSF3_t {
      border-radius: ${ir} !important;
      overflow: hidden !important;
    }

    div[role="alert"] ._2V2sHETNfa62yMoDwSF3_t {
      border: ${s.iconBorder ? `2px solid ${s.accentColor}` : "none"} !important;
      box-shadow: ${s.iconBorder ? `0 0 8px ${s.accentColor}66` : "none"} !important;
    }

    div[role="alert"] ._18PwvOcpWfW3M8j2-bEPPJ {
      color: ${s.textColor} !important;
      font-weight: bold !important;
    }

    div[role="alert"] ._2jpxEWvo06efD6-NR1cplA {
      color: ${s.descColor} !important;
    }

    div[role="alert"] ._2F0wqsu2mqsHxBSJcu1sPJ,
    div[role="alert"] ._2F0wqsu2mqsHxBSJcu1sPJ svg {
      color: ${s.accentColor} !important;
      fill: currentColor !important;
    }
  `;
}

function injectNotifCSS(s: ThemeSettings): void {
  const css = buildNativeToastCSS(s);
  const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  executeInTab("notificationtoasts_uid2", false, `
    (function() {
      var el = document.getElementById("xbox-achievements-notif-css");
      if (el) el.remove();
      var style = document.createElement("style");
      style.id = "xbox-achievements-notif-css";
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
    console.error("[XboxAchievements] Failed to save settings", error);
  });
}

const ACHIEVEMENT_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path d="M30 30.05H26L24 34.05L20.11 27.57L22.9 24.8701L26.9 24.81L30 30.05ZM13.1 24.8701L9.1 24.81L6 30.05H10L12 34.05L15.89 27.57L13.1 24.8701ZM22.5 13.05C22.5 12.16 22.2361 11.29 21.7416 10.55C21.2471 9.80996 20.5443 9.23318 19.7221 8.89259C18.8998 8.552 17.995 8.46288 17.1221 8.63651C16.2492 8.81015 15.4474 9.23873 14.818 9.86807C14.1887 10.4974 13.7601 11.2992 13.5865 12.1721C13.4128 13.0451 13.5019 13.9499 13.8425 14.7721C14.1831 15.5944 14.7599 16.2972 15.4999 16.7917C16.24 17.2861 17.11 17.55 18 17.55C18.5913 17.5514 19.1771 17.4359 19.7236 17.2102C20.2702 16.9845 20.7668 16.6531 21.1849 16.235C21.603 15.8168 21.9345 15.3202 22.1601 14.7737C22.3858 14.2271 22.5013 13.6414 22.5 13.05ZM29 13.05L25.85 16.3L25.78 20.83L21.25 20.9L18 24.05L14.75 20.9L10.22 20.83L10.15 16.3L7 13.05L10.15 9.80005L10.22 5.27005L14.75 5.20005L18 2.05005L21.25 5.20005L25.78 5.27005L25.85 9.80005L29 13.05Z" fill="currentColor"></path></svg>`;

const SAMPLE_ACHIEVEMENT_IMAGE = "https://shared.steamstatic.com/community_assets/images/apps/22380/ee1e9636c2b7d5add9123ef556c80fdd87ba1669.jpg";

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

  toaster.toast({
    logo: (
      <>
        <style>{buildToastCSS(s, rarity)}</style>
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
    className: "xbox-achievement-toast",
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
        console.error("[XboxAchievements] Failed to load settings", error);
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
      </PanelSection>

      <PanelSection title="Effects">
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
          <SliderField
            label="Border Radius"
            value={settings.borderRadius}
            min={0}
            max={24}
            step={2}
            onChange={(v) => update({ borderRadius: v })}
            showValue
            valueSuffix="px"
          />
        </PanelSectionRow>
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

  const register = steamClient?.GameSessions?.RegisterForAchievementNotification;
  if (typeof register === "function") {
    try {
      unregister = register((notification) => {
        const achieved = extractAchievement(notification);

        if (!achieved) {
          console.warn("[XboxAchievements] Unrecognized achievement notification payload", notification);
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
      console.warn("[XboxAchievements] RegisterForAchievementNotification failed:", e);
    }
  } else {
    console.warn("[XboxAchievements] RegisterForAchievementNotification is unavailable");
  }

  return {
    name: "Xbox Achievements",
    titleView: <div className={staticClasses.Title}>Xbox Achievements</div>,
    content: <Content />,
    icon: <FaPalette />,
    onDismount() {
      unregister?.unregister?.();
      if (currentPageCssId) {
        removeCssFromTab("Steam Big Picture Mode", currentPageCssId);
      }
      executeInTab("notificationtoasts_uid2", false, `
        var el = document.getElementById("xbox-achievements-notif-css");
        if (el) el.remove();
      `).catch(() => {});
    },
  };
});