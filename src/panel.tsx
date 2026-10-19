/**
 * @fileoverview The Quick Access panel: preview, test toasts and theme
 * settings.
 */

import {callable} from '@decky/api';
import {
  ButtonItem,
  ColorPickerModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
  showModal,
} from '@decky/ui';
import {useEffect, useState} from 'react';

import {ensureMainWindowCss} from './main_window';
import {
  type PresetName,
  type ThemeSettings,
  BANNER_STYLE_OPTIONS,
  DECORATION_OPTIONS,
  DEFAULT_SETTINGS,
  ENTRANCE_OPTIONS,
  ICON_SHAPE_OPTIONS,
  PRESETS,
  PRESET_OPTIONS,
  TOAST_SHAPE_OPTIONS,
  getCurrentSettings,
  hexToHsl,
  hslToHex,
  sanitizeSettings,
  setCurrentSettings,
} from './settings';
import {fireTestAchievement} from './steam';
import {type ToastAchievement, AchievementToast} from './toast';

const getSettings = callable<[], Partial<ThemeSettings>>('get_settings');
const saveSettings = callable<[settings: ThemeSettings], boolean>(
  'save_settings',
);

const SAMPLE_IMAGE =
  'https://shared.steamstatic.com/community_assets/images/apps/22380/ee1e9636c2b7d5add9123ef556c80fdd87ba1669.jpg';

type SampleName = 'unlock' | 'rare' | 'ultra' | 'progress';

const SAMPLES: Record<SampleName, ToastAchievement> = {
  unlock: {
    appId: 0,
    id: 'sample_unlock',
    name: 'Master of the Entirely Unnecessary Grind',
    description:
      'Unlock every collectible across all nine regions without fast travel',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 42.5,
  },
  rare: {
    appId: 0,
    id: 'sample_rare',
    name: 'Sharpshooter',
    description: 'Land 50 consecutive headshots without missing a single shot',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 4.2,
  },
  ultra: {
    appId: 0,
    id: 'sample_ultra',
    name: 'Diamond Hands',
    description: 'Finish the campaign on Nightmare without dying once',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 0.6,
  },
  progress: {
    appId: 0,
    id: 'sample_progress',
    name: 'Collector',
    description: 'Collect 10,000 gold',
    image: SAMPLE_IMAGE,
    achieved: false,
    globalPercent: 18,
    progress: {min: 0, current: 3456, max: 10000},
  },
};

const PREVIEW: ToastAchievement = {
  ...SAMPLES.unlock,
  name: 'Achievement Unlocked',
  description: 'Preview of your theme',
};

interface TestButton {
  sample: SampleName;
  label: string;
  description: string;
}

const TEST_BUTTONS: TestButton[] = [
  {
    sample: 'unlock',
    label: 'Achievement',
    description: 'Long title and description to check truncation',
  },
  {sample: 'rare', label: 'Rare', description: 'Under 10% of players'},
  {sample: 'ultra', label: 'Ultra Rare', description: 'Under 1% of players'},
  {
    sample: 'progress',
    label: 'Progress',
    description: 'Partial progress toward an achievement',
  },
];

interface ColorButtonProps {
  color: string;
  label: string;
  onChange: (color: string) => void;
}

function ColorButton({color, label, onChange}: ColorButtonProps) {
  const hsl = hexToHsl(color);
  const openPicker = () => {
    showModal(
      <ColorPickerModal
        title={label}
        defaultH={hsl.h}
        defaultS={hsl.s}
        defaultL={hsl.l}
        onConfirm={(value) => {
          const hex = hslToHex(value);
          // Untouched sliders return the rounded start color; keep the exact
          // one and the preset.
          const start = hslToHex(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
          if (hex && hex !== start) onChange(hex);
        }}
        closeModal={() => {}}
      />,
    );
  };
  return (
    <ButtonItem layout="below" onClick={openPicker}>
      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: color,
            border: '1px solid rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}
        />
        <span>{label}</span>
      </div>
    </ButtonItem>
  );
}

/** The plugin's Quick Access panel. */
export function Panel() {
  const [settings, setSettings] = useState<ThemeSettings>(getCurrentSettings());
  const [loaded, setLoaded] = useState(false);
  // Steam's Reduce Motion setting reaches every CEF window as
  // prefers-reduced-motion.
  const [steamReducesMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    getSettings()
      .then((stored) => {
        const clean = sanitizeSettings(stored);
        setSettings(clean);
        setCurrentSettings(clean);
        ensureMainWindowCss(clean);
      })
      .catch((error: unknown) => {
        console.error('[AchievementCustomizer] Failed to load settings', error);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  const update = (partial: Partial<ThemeSettings>) => {
    const next = sanitizeSettings({...settings, ...partial});
    setSettings(next);
    setCurrentSettings(next);
    saveSettings(next).catch((error: unknown) => {
      console.error('[AchievementCustomizer] Failed to save settings', error);
    });
    ensureMainWindowCss(next);
  };

  const applyPreset = (preset: PresetName) => {
    update(preset === 'custom' ? {preset} : {preset, ...PRESETS[preset]});
  };

  if (!loaded) return null;

  return (
    <>
      <PanelSection title="Preview">
        <PanelSectionRow>
          <AchievementToast
            // Keyed on the settings so every change replays the entrance.
            key={JSON.stringify(settings)}
            achievement={PREVIEW}
            settings={settings}
            mode="preview"
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Test Toasts">
        {TEST_BUTTONS.map((button) => (
          <PanelSectionRow key={button.sample}>
            <ButtonItem
              layout="below"
              description={button.description}
              onClick={() => {
                fireTestAchievement(SAMPLES[button.sample]);
              }}
            >
              {button.label}
            </ButtonItem>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <div style={{fontSize: '12px', opacity: 0.7, padding: '4px 0'}}>
            Test toasts go through Steam's own notification system. If nothing
            shows up, check Steam Settings › Notifications › Achievement
            Unlocked.
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Theme">
        <PanelSectionRow>
          <DropdownItem
            label="Preset"
            rgOptions={PRESET_OPTIONS}
            selectedOption={settings.preset}
            onChange={(option) => {
              applyPreset(option.data);
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Colors">
        <PanelSectionRow>
          <ColorButton
            color={settings.primaryColor}
            label="Primary"
            onChange={(color) => {
              update({primaryColor: color, preset: 'custom'});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton
            color={settings.secondaryColor}
            label="Secondary"
            onChange={(color) => {
              update({secondaryColor: color, preset: 'custom'});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton
            color={settings.accentColor}
            label="Accent / Glow"
            onChange={(color) => {
              update({accentColor: color, preset: 'custom'});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton
            color={settings.textColor}
            label="Title Text"
            onChange={(color) => {
              update({textColor: color, preset: 'custom'});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ColorButton
            color={settings.descColor}
            label="Description Text"
            onChange={(color) => {
              update({descColor: color, preset: 'custom'});
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Style">
        <PanelSectionRow>
          <DropdownItem
            label="Banner Style"
            rgOptions={BANNER_STYLE_OPTIONS}
            selectedOption={settings.bannerStyle}
            onChange={(option) => {
              update({bannerStyle: option.data});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Icon Shape"
            rgOptions={ICON_SHAPE_OPTIONS}
            selectedOption={settings.iconShape}
            onChange={(option) => {
              update({iconShape: option.data});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Icon Border"
            checked={settings.iconBorder}
            onChange={(checked) => {
              update({iconBorder: checked});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Toast Shape"
            rgOptions={TOAST_SHAPE_OPTIONS}
            selectedOption={
              TOAST_SHAPE_OPTIONS.find(
                (option) => option.data === settings.borderRadius,
              )?.data ?? 8
            }
            onChange={(option) => {
              update({borderRadius: option.data});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Decorations"
            description="Animated overlay behind the toast text"
            rgOptions={DECORATION_OPTIONS}
            selectedOption={settings.decorativeElements}
            onChange={(option) => {
              update({decorativeElements: option.data});
            }}
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
              onChange={(checked) => {
                update({ignoreReducedMotion: checked});
              }}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Entrance Animation"
            description="Animate the toast as it appears"
            checked={settings.popupAnimation}
            onChange={(checked) => {
              update({popupAnimation: checked});
            }}
          />
        </PanelSectionRow>
        {settings.popupAnimation && (
          <PanelSectionRow>
            <DropdownItem
              label="Entrance Style"
              rgOptions={ENTRANCE_OPTIONS}
              selectedOption={settings.entranceStyle}
              onChange={(option) => {
                update({entranceStyle: option.data});
              }}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Shine Sweep"
            description="Light sweeps across the toast on arrival"
            checked={settings.shineEnabled}
            onChange={(checked) => {
              update({shineEnabled: checked});
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Glow Effect"
            checked={settings.glowEnabled}
            onChange={(checked) => {
              update({glowEnabled: checked});
            }}
          />
        </PanelSectionRow>
        {settings.glowEnabled && (
          <PanelSectionRow>
            <SliderField
              label="Glow Intensity"
              value={settings.glowIntensity}
              min={5}
              max={50}
              step={5}
              onChange={(value) => {
                update({glowIntensity: value});
              }}
              showValue
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ToggleField
            label="Rarity Effects"
            description="Gold for rare, diamond for ultra rare unlocks"
            checked={settings.rarityEffects}
            onChange={(checked) => {
              update({rarityEffects: checked});
            }}
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
            onChange={(seconds) => {
              update({duration: seconds * 1000});
            }}
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
              update(DEFAULT_SETTINGS);
            }}
          >
            Reset to Default
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
