import {
  ButtonItem,
  ColorPickerModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
  showModal,
} from "@decky/ui";
import { callable } from "@decky/api";
import { useEffect, useState } from "react";
import {
  BANNER_STYLE_OPTIONS,
  DECORATION_OPTIONS,
  DEFAULT_SETTINGS,
  ENTRANCE_OPTIONS,
  ICON_SHAPE_OPTIONS,
  PRESETS,
  PRESET_OPTIONS,
  PresetName,
  TOAST_SHAPE_OPTIONS,
  ThemeSettings,
  getCurrentSettings,
  sanitizeSettings,
  setCurrentSettings,
} from "./settings";
import { AchievementToast, ToastAchievement } from "./toast";
import { fireTestAchievement } from "./steam";
import { ensureMainWindowCSS } from "./mainWindow";

const getSettings = callable<[], Partial<ThemeSettings>>("get_settings");
const saveSettings = callable<[settings: ThemeSettings], boolean>("save_settings");

const SAMPLE_IMAGE =
  "https://shared.steamstatic.com/community_assets/images/apps/22380/ee1e9636c2b7d5add9123ef556c80fdd87ba1669.jpg";

const SAMPLES: Record<"unlock" | "rare" | "ultra" | "progress", ToastAchievement> = {
  unlock: {
    appid: 0,
    id: "sample_unlock",
    name: "Master of the Entirely Unnecessary Grind",
    description: "Unlock every collectible across all nine regions without fast travel",
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPct: 42.5,
  },
  rare: {
    appid: 0,
    id: "sample_rare",
    name: "Sharpshooter",
    description: "Land 50 consecutive headshots without missing a single shot",
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPct: 4.2,
  },
  ultra: {
    appid: 0,
    id: "sample_ultra",
    name: "Diamond Hands",
    description: "Finish the campaign on Nightmare without dying once",
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPct: 0.6,
  },
  progress: {
    appid: 0,
    id: "sample_progress",
    name: "Collector",
    description: "Collect 10,000 gold",
    image: SAMPLE_IMAGE,
    achieved: false,
    globalPct: 18,
    progress: { min: 0, current: 3456, max: 10000 },
  },
};

const PREVIEW: ToastAchievement = {
  ...SAMPLES.unlock,
  name: "Achievement Unlocked",
  description: "Preview of your theme",
};

function hexToHSL(hex: string): { h: number; s: number; l: number } {
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

function hslStringToHex(hsl: string): string | null {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
  if (!match) return null;
  const h = parseInt(match[1], 10) / 360;
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;
  const hue = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rgb: [number, number, number];
  if (s === 0) {
    rgb = [l, l, l];
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  }
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}

function ColorButton({ color, label, onChange }: { color: string; label: string; onChange: (c: string) => void }) {
  const hsl = hexToHSL(color);
  return (
    <ButtonItem
      layout="below"
      onClick={() =>
        showModal(
          <ColorPickerModal
            title={label}
            defaultH={hsl.h}
            defaultS={hsl.s}
            defaultL={hsl.l}
            onConfirm={(value) => {
              const hex = hslStringToHex(value);
              if (hex) onChange(hex);
            }}
            closeModal={() => {}}
          />,
        )
      }
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

const TEST_BUTTONS: { key: keyof typeof SAMPLES; label: string; description: string }[] = [
  { key: "unlock", label: "Achievement", description: "Long title and description to check truncation" },
  { key: "rare", label: "Rare", description: "Under 10% of players" },
  { key: "ultra", label: "Ultra Rare", description: "Under 1% of players" },
  { key: "progress", label: "Progress", description: "Partial progress toward an achievement" },
];

export function Panel() {
  const [settings, setSettings] = useState<ThemeSettings>(getCurrentSettings());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const clean = sanitizeSettings(s);
        setSettings(clean);
        setCurrentSettings(clean);
        ensureMainWindowCSS(clean);
      })
      .catch((error) => console.error("[AchievementCustomizer] Failed to load settings", error))
      .finally(() => setLoaded(true));
  }, []);

  const update = (partial: Partial<ThemeSettings>) => {
    const next = sanitizeSettings({ ...settings, ...partial });
    setSettings(next);
    setCurrentSettings(next);
    saveSettings(next).catch((error) => console.error("[AchievementCustomizer] Failed to save settings", error));
    ensureMainWindowCSS(next);
  };

  const applyPreset = (preset: PresetName) => {
    update(preset === "custom" ? { preset } : { preset, ...PRESETS[preset] });
  };

  if (!loaded) return null;

  return (
    <>
      <PanelSection title="Preview">
        <PanelSectionRow>
          {/* Keyed on the settings so every change replays the entrance. */}
          <AchievementToast key={JSON.stringify(settings)} achievement={PREVIEW} settings={settings} mode="preview" />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Test Toasts">
        {TEST_BUTTONS.map((t) => (
          <PanelSectionRow key={t.key}>
            <ButtonItem layout="below" description={t.description} onClick={() => fireTestAchievement(SAMPLES[t.key])}>
              {t.label}
            </ButtonItem>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <div style={{ fontSize: "12px", opacity: 0.7, padding: "4px 0" }}>
            Test toasts go through Steam's own notification system. If nothing shows up, check Steam Settings ›
            Notifications › Achievement Unlocked.
          </div>
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
            description="Animated overlay behind the toast text"
            rgOptions={DECORATION_OPTIONS}
            selectedOption={settings.decorativeElements}
            onChange={(opt) => update({ decorativeElements: opt.data })}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Effects">
        <PanelSectionRow>
          <ToggleField
            label="Entrance Animation"
            description="Animate the toast as it appears"
            checked={settings.popupAnimation}
            onChange={(v) => update({ popupAnimation: v })}
          />
        </PanelSectionRow>
        {settings.popupAnimation && (
          <PanelSectionRow>
            <DropdownItem
              label="Entrance Style"
              rgOptions={ENTRANCE_OPTIONS}
              selectedOption={settings.entranceStyle}
              onChange={(opt) => update({ entranceStyle: opt.data })}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Shine Sweep"
            description="Light sweeps across the toast on arrival"
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
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Rarity Effects"
            description="Gold for rare, diamond for ultra rare unlocks"
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
          <ButtonItem layout="below" onClick={() => update(DEFAULT_SETTINGS)}>
            Reset to Default
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
