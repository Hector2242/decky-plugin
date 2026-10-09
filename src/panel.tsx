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
  hexToHsl,
  hslToHex,
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

function ColorButton({ color, label, onChange }: { color: string; label: string; onChange: (c: string) => void }) {
  const hsl = hexToHsl(color);
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
              const hex = hslToHex(value);
              // Untouched sliders return the rounded start color; keep the exact one and the preset.
              if (hex && hex !== hslToHex(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)) onChange(hex);
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
  // Steam's Reduce Motion setting reaches every CEF window as prefers-reduced-motion.
  const [steamReducesMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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
        {steamReducesMotion && (
          <PanelSectionRow>
            <ToggleField
              label="Animate anyway"
              description="Steam's Reduce Motion is on, so toasts use simple fades. Turn this on for full animations."
              checked={settings.ignoreReducedMotion}
              onChange={(v) => update({ ignoreReducedMotion: v })}
            />
          </PanelSectionRow>
        )}
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
