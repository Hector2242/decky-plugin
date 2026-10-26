/**
 * @fileoverview The Quick Access panel: preview, test toasts and theme
 * settings.
 */

import {callable, useQuickAccessVisible} from '@decky/api';
import {
  ButtonItem,
  ColorPickerModal,
  DropdownItem,
  Focusable,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
  showModal,
} from '@decky/ui';
import {useEffect, useState} from 'react';

import {hasDecorationBackground} from './decorations';
import {ensureMainWindowCss} from './main_window';
import {
  type PresetName,
  type ThemeSettings,
  BANNER_STYLE_OPTIONS,
  DECORATION_OPTIONS,
  DEFAULT_SETTINGS,
  ENTRANCE_OPTIONS,
  ICON_SHAPE_OPTIONS,
  POSITION_OPTIONS,
  PRESETS,
  PRESET_OPTIONS,
  REVEAL_OPTIONS,
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

type SampleName = 'unlock' | 'silver' | 'gold' | 'platinum' | 'progress';

const SAMPLES: Record<SampleName, ToastAchievement> = {
  unlock: {
    appId: 0,
    id: 'sample_unlock',
    name: 'Master of the Entirely Unnecessary Grind',
    description:
      'Unlock every collectible across all nine regions without fast travel',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 62.5,
  },
  silver: {
    appId: 0,
    id: 'sample_silver',
    name: 'Explorer',
    description: 'Discover every hidden area in the first region',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 31.7,
  },
  gold: {
    appId: 0,
    id: 'sample_gold',
    name: 'Sharpshooter',
    description: 'Land 50 consecutive headshots without missing a single shot',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 9.6,
  },
  platinum: {
    appId: 0,
    id: 'sample_platinum',
    name: 'Diamond Hands',
    description: 'Finish the campaign on Nightmare without dying once',
    image: SAMPLE_IMAGE,
    achieved: true,
    globalPercent: 0.6,
    completesGame: true,
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
  /** Label and description while Trophy Tiers is off. */
  plain: [string, string];
}

const TEST_BUTTONS: TestButton[] = [
  {
    sample: 'unlock',
    label: 'Achievement',
    description:
      'Bronze, with a long title and description to check truncation',
    plain: ['Achievement', 'Long title and description to check truncation'],
  },
  {
    sample: 'silver',
    label: 'Silver',
    description: 'Under 50% of players',
    plain: [
      `${SAMPLES.silver.globalPercent}% of players`,
      'Shows the share of players who have it',
    ],
  },
  {
    sample: 'gold',
    label: 'Gold',
    description: 'Under 15% of players',
    plain: [
      `${SAMPLES.gold.globalPercent}% of players`,
      'Shows the share of players who have it',
    ],
  },
  {
    sample: 'platinum',
    label: 'Platinum',
    description: 'The last achievement of a game (100%)',
    plain: [
      `${SAMPLES.platinum.globalPercent}% of players`,
      'Shows the share of players who have it',
    ],
  },
  {
    sample: 'progress',
    label: 'Progress',
    description: 'Partial progress toward an achievement',
    plain: ['Progress', 'Partial progress toward an achievement'],
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

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

interface PanelProps {
  /** False once Decky unloaded this copy; its panel can stay on screen. */
  isActive: () => boolean;
}

/** The plugin's Quick Access panel. */
export function Panel({isActive}: PanelProps) {
  const [settings, setSettings] = useState<ThemeSettings>(getCurrentSettings());
  const [loaded, setLoaded] = useState(false);
  // Steam's Reduce Motion setting reaches every CEF window as
  // prefers-reduced-motion. The panel stays mounted (alwaysRender), so it is
  // read again each time Quick Access opens.
  const visible = useQuickAccessVisible();
  const [steamReducesMotion, setSteamReducesMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION).matches,
  );
  // Counts openings so the preview replays its entrance each time.
  const [opens, setOpens] = useState(0);
  useEffect(() => {
    if (visible) {
      setSteamReducesMotion(window.matchMedia(REDUCED_MOTION).matches);
      setOpens((count) => count + 1);
    }
  }, [visible]);

  useEffect(() => {
    getSettings()
      .then((stored) => {
        const clean = sanitizeSettings(stored);
        setSettings(clean);
        if (!isActive()) return;
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
    saveSettings(next).catch((error: unknown) => {
      console.error('[AchievementCustomizer] Failed to save settings', error);
    });
    // An unloaded copy's CSS would never be removed; the backend's
    // settings_changed broadcast reaches the loaded copy instead.
    if (!isActive()) return;
    setCurrentSettings(next);
    ensureMainWindowCss(next);
  };

  const applyPreset = (preset: PresetName) => {
    update(preset === 'custom' ? {preset} : {preset, ...PRESETS[preset]});
  };

  if (!loaded) return null;

  // Presets use radii between the menu's steps; list the real one.
  const shapeOptions = TOAST_SHAPE_OPTIONS.some(
    (option) => option.data === settings.borderRadius,
  )
    ? TOAST_SHAPE_OPTIONS
    : [
        ...TOAST_SHAPE_OPTIONS,
        {data: settings.borderRadius, label: `${settings.borderRadius}px`},
      ];

  return (
    <>
      <PanelSection title="Preview">
        <PanelSectionRow>
          {/* A D-pad stop: the title bar above is sticky, so focusing it never
              scrolls the preview back into view. */}
          <Focusable onActivate={() => {}}>
            <AchievementToast
              // Keyed on the settings and openings so each replays the entrance.
              key={`${opens}:${JSON.stringify(settings)}`}
              achievement={PREVIEW}
              settings={settings}
              mode="preview"
            />
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Test Toasts">
        {TEST_BUTTONS.map((button) => {
          const [label, description] = settings.rarityEffects
            ? [button.label, button.description]
            : button.plain;
          return (
            <PanelSectionRow key={button.sample}>
              <ButtonItem
                layout="below"
                description={description}
                onClick={() => {
                  fireTestAchievement(SAMPLES[button.sample]);
                }}
              >
                {label}
              </ButtonItem>
            </PanelSectionRow>
          );
        })}
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
            // Decorations that paint their own sky replace the toast banner;
            // the achievements page still uses it.
            description={
              hasDecorationBackground(settings.decorativeElements)
                ? 'Toast uses the decoration; still styles the achievements page'
                : undefined
            }
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
            rgOptions={shapeOptions}
            selectedOption={settings.borderRadius}
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
            label="Trophy Tiers"
            description="Bronze, silver, gold or platinum by how many players have it"
            checked={settings.rarityEffects}
            onChange={(checked) => {
              update({rarityEffects: checked});
            }}
          />
        </PanelSectionRow>
        {settings.rarityEffects && (
          <PanelSectionRow>
            <DropdownItem
              label="Trophy Reveal"
              description="How the icon turns into its trophy"
              rgOptions={REVEAL_OPTIONS}
              selectedOption={settings.trophyReveal}
              onChange={(option) => {
                update({trophyReveal: option.data});
              }}
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Position & Timing">
        <PanelSectionRow>
          <DropdownItem
            label="Position"
            description="Moves every Steam notification, not just achievements"
            rgOptions={POSITION_OPTIONS}
            selectedOption={settings.position}
            onChange={(option) => {
              update({position: option.data});
            }}
          />
        </PanelSectionRow>
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
