import {
  addEventListener,
  callable,
  definePlugin,
  removeEventListener,
} from '@decky/api';
import {staticClasses} from '@decky/ui';

import {ensureMainWindowCss, removeMainWindowCss} from './main_window';
import {PaletteIcon} from './palette_icon';
import {Panel} from './panel';
import {
  type ThemeSettings,
  getCurrentSettings,
  sanitizeSettings,
  setCurrentSettings,
} from './settings';
import {installDurationPatch, installToastRenderPatch} from './steam';

const getSettings = callable<[], Partial<ThemeSettings>>('get_settings');

const CSS_RETRY_MS = 5000;
// Sent by main.py after every save.
const SETTINGS_CHANGED = 'settings_changed';

// Decky Loader loads a plugin through the bundle's default export.
export default definePlugin(() => {
  const unpatchRender = installToastRenderPatch();
  const unpatchDuration = installDurationPatch();

  // When Decky reloads the plugin, the Quick Access menu can keep showing the
  // previous copy's panel, whose changes never reach this copy's toast hooks.
  // Every save is broadcast by the backend, so the hooks follow any panel.
  const onSettingsChanged = (stored: Partial<ThemeSettings>) => {
    setCurrentSettings(sanitizeSettings(stored));
    ensureMainWindowCss(getCurrentSettings());
  };
  addEventListener<[settings: Partial<ThemeSettings>]>(
    SETTINGS_CHANGED,
    onSettingsChanged,
  );

  // The main window may not exist yet while Decky is still starting up.
  let retry: ReturnType<typeof setInterval> | undefined;
  const applyCss = () => {
    if (ensureMainWindowCss(getCurrentSettings()) && retry) {
      clearInterval(retry);
      retry = undefined;
    }
  };
  getSettings()
    .then((stored) => {
      setCurrentSettings(sanitizeSettings(stored));
    })
    .catch((error: unknown) => {
      console.error('[AchievementCustomizer] Failed to load settings', error);
    })
    .finally(() => {
      if (!ensureMainWindowCss(getCurrentSettings())) {
        retry = setInterval(applyCss, CSS_RETRY_MS);
      }
    });

  return {
    name: 'Achievement Customizer',
    titleView: (
      <div className={staticClasses.Title}>Achievement Customizer</div>
    ),
    content: <Panel />,
    icon: <PaletteIcon />,
    onDismount() {
      removeEventListener(SETTINGS_CHANGED, onSettingsChanged);
      if (retry) clearInterval(retry);
      unpatchRender();
      unpatchDuration();
      removeMainWindowCss();
    },
  };
});
