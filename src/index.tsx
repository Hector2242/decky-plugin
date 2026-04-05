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

  const bg = s.bannerStyle === "solid"
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
    }
    .xbox-achievement-toast > div {
      background: transparent !important;
    }
    ${rarity?.extraCSS || ""}
  `;
}

let currentSettings: ThemeSettings = { preset: "xbox", ...PRESETS.xbox };
let currentPageCssId: string | null = null;

function reinjectPageCSS(s: ThemeSettings): void {
  if (currentPageCssId) {
    removeCssFromTab("Steam Big Picture Mode", currentPageCssId);
  }

  currentPageCssId = injectCssIntoTab(
    "Steam Big Picture Mode",
    buildAchievementPageCSS(s),
  );
}

function saveSettingsSafe(settings: ThemeSettings): void {
  saveSettings(settings).catch((error) => {
    console.error("[XboxAchievements] Failed to save settings", error);
  });
}

function fireXboxToast(name: string, description: string, imageUrl?: string, globalPct?: number): void {
  const s = currentSettings;
  const rarity = getRarityOverride(globalPct ?? -1, s.rarityEffects);
  const accent = rarity?.accentColor || s.accentColor;
  const ir = iconRadius(s.iconShape);

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
      <span style={{ color: s.textColor, fontWeight: "bold" }}>{name}</span>
    </div>
  ) : (
    <span style={{ color: s.textColor, fontWeight: "bold" }}>{name}</span>
  );

  toaster.toast({
    logo: (
      <>
        <style>{buildToastCSS(s, rarity)}</style>
        {imageUrl ? (
          <img
            src={imageUrl}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: ir,
              border: s.iconBorder ? `2px solid ${accent}` : "none",
              boxShadow: s.iconBorder ? `0 0 8px ${accent}66` : "none",
            }}
          />
        ) : (
          <span style={{ fontSize: "24px" }}>🏆</span>
        )}
      </>
    ),
    title: titleContent,
    body: <span style={{ color: s.descColor }}>{description}</span>,
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
  const bg = settings.bannerStyle === "glass"
    ? { background: `${settings.primaryColor}cc`, backdropFilter: "blur(10px)" }
    : settings.bannerStyle === "solid"
      ? { background: settings.primaryColor }
      : { background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` };

  const ir = iconRadius(settings.iconShape);

  return (
    <div
      style={{
        ...bg,
        border: `2px solid ${settings.accentColor}`,
        borderRadius: `${settings.borderRadius}px`,
        boxShadow: settings.glowEnabled
          ? `0 0 ${settings.glowIntensity}px ${settings.accentColor}88`
          : "none",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: ir,
          border: settings.iconBorder ? `2px solid ${settings.accentColor}` : "none",
          backgroundColor: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          flexShrink: 0,
        }}
      >
        🏆
      </div>
      <div>
        <div style={{ color: settings.textColor, fontWeight: "bold", fontSize: "13px" }}>
          Achievement Unlocked
        </div>
        <div style={{ color: settings.descColor, fontSize: "11px" }}>
          Preview of your theme
        </div>
      </div>
    </div>
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
    reinjectPageCSS(next);
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
            onClick={() => fireXboxToast("Test Achievement", "You triggered a test notification!")}
          >
            Test Toast
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fireXboxToast("Diamond Hands", "Less than 1% of players unlocked this!", undefined, 0.5)}
          >
            Test Ultra Rare
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fireXboxToast("Sharpshooter", "Only 5% of players unlocked this!", undefined, 5)}
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
                reinjectPageCSS(defaults);
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
      currentPageCssId = injectCssIntoTab(
        "Steam Big Picture Mode",
        buildAchievementPageCSS(settings),
      );
    })
    .catch(() => {
      currentPageCssId = injectCssIntoTab(
        "Steam Big Picture Mode",
        buildAchievementPageCSS(currentSettings),
      );
    });

  const steamClient = (globalThis as typeof globalThis & { SteamClient?: SteamClientShape }).SteamClient;
  let unregister: RegisterHandle | undefined;

  const register = steamClient?.GameSessions?.RegisterForAchievementNotification;
  if (typeof register === "function") {
    unregister = register((notification) => {
      const achieved = extractAchievement(notification);

      if (!achieved) {
        console.warn("[XboxAchievements] Unrecognized achievement notification payload", notification);
        return;
      }

      fireXboxToast(
        achieved.strName ?? achieved.strDisplayName ?? "Achievement Unlocked",
        achieved.strDescription ?? achieved.strDesc ?? "",
        achieved.strImage ?? achieved.strIcon,
        typeof achieved.flAchieved === "number" ? achieved.flAchieved : -1,
      );
    });
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
    },
  };
});