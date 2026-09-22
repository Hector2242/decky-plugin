import { staticClasses } from "@decky/ui";
import { callable, definePlugin } from "@decky/api";
import { FaPalette } from "react-icons/fa";
import { ThemeSettings, getCurrentSettings, sanitizeSettings, setCurrentSettings } from "./settings";
import { installDurationPatch, installToastRenderPatch } from "./steam";
import { ensureMainWindowCSS, removeMainWindowCSS } from "./mainWindow";
import { Panel } from "./panel";

const getSettings = callable<[], Partial<ThemeSettings>>("get_settings");

export default definePlugin(() => {
  const unpatchRender = installToastRenderPatch();
  const unpatchDuration = installDurationPatch();

  // The main window may not exist yet while Decky is still starting up.
  let retry: ReturnType<typeof setInterval> | undefined;
  const applyCSS = () => {
    if (ensureMainWindowCSS(getCurrentSettings()) && retry) {
      clearInterval(retry);
      retry = undefined;
    }
  };
  getSettings()
    .then((s) => setCurrentSettings(sanitizeSettings(s)))
    .catch((error) => console.error("[AchievementCustomizer] Failed to load settings", error))
    .finally(() => {
      if (!ensureMainWindowCSS(getCurrentSettings())) retry = setInterval(applyCSS, 5000);
    });

  return {
    name: "Achievement Customizer",
    titleView: <div className={staticClasses.Title}>Achievement Customizer</div>,
    content: <Panel />,
    icon: <FaPalette />,
    onDismount() {
      if (retry) clearInterval(retry);
      unpatchRender();
      unpatchDuration();
      removeMainWindowCSS();
    },
  };
});
