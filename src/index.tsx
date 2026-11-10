import {
  addEventListener,
  callable,
  definePlugin,
  removeEventListener,
  routerHook,
} from '@decky/api';
import {staticClasses} from '@decky/ui';

import {loadAsset} from './assets';
import {Editor} from './editor';
import {ensureMainWindowCss, removeMainWindowCss} from './main_window';
import {PaletteIcon} from './palette_icon';
import {Panel} from './panel';
import {
  type ThemeSettings,
  SETTINGS_CHANGED,
  getCurrentSettings,
  sanitizeSettings,
  setCurrentSettings,
} from './settings';
import {
  EDITOR_ROUTE,
  installCompletionTracking,
  installDurationPatch,
  installSoundPatch,
  installToastRenderPatch,
} from './steam';

const getSettings = callable<[], Partial<ThemeSettings>>('get_settings');

const CSS_RETRY_MS = 5000;

// Imported files load ahead of the next toast, which needs them at once.
function preloadAssets(settings: ThemeSettings): void {
  for (const name of Object.values(settings.trophyImages)) void loadAsset(name);
  void loadAsset(settings.customSound);
}

// Decky Loader loads a plugin through the bundle's default export.
export default definePlugin(() => {
  const unpatchRender = installToastRenderPatch();
  const unpatchDuration = installDurationPatch();
  const stopCompletionTracking = installCompletionTracking();
  const unpatchSound = installSoundPatch();
  routerHook.addRoute(EDITOR_ROUTE, Editor, {exact: true});

  // When Decky reloads the plugin, the Quick Access menu can keep showing the
  // previous copy's panel, whose changes never reach this copy's toast hooks.
  // Every save is broadcast by the backend, so the hooks follow any panel.
  const onSettingsChanged = (stored: Partial<ThemeSettings>) => {
    setCurrentSettings(sanitizeSettings(stored));
    ensureMainWindowCss(getCurrentSettings());
    preloadAssets(getCurrentSettings());
  };
  addEventListener<[settings: Partial<ThemeSettings>]>(
    SETTINGS_CHANGED,
    onSettingsChanged,
  );

  // Set on unload; this copy's Quick Access panel can outlive it.
  let unloaded = false;
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
      preloadAssets(getCurrentSettings());
    })
    .catch((error: unknown) => {
      console.error('[AchievementCustomizer] Failed to load settings', error);
    })
    .finally(() => {
      if (unloaded) return;
      if (!ensureMainWindowCss(getCurrentSettings())) {
        retry = setInterval(applyCss, CSS_RETRY_MS);
      }
    });

  return {
    name: 'Achievement Customizer',
    titleView: (
      // Older Decky builds leave staticClasses undefined on newer Steam.
      <div className={staticClasses?.Title}>Achievement Customizer</div>
    ),
    content: <Panel isActive={() => !unloaded} />,
    alwaysRender: true,
    icon: <PaletteIcon />,
    onDismount() {
      unloaded = true;
      removeEventListener(SETTINGS_CHANGED, onSettingsChanged);
      if (retry) clearInterval(retry);
      unpatchRender();
      unpatchDuration();
      stopCompletionTracking();
      unpatchSound();
      routerHook.removeRoute(EDITOR_ROUTE);
      removeMainWindowCss();
    },
  };
});
