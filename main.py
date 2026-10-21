import contextlib
import json
import os
import shutil
from typing import Any, Dict

import decky

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

# Mirrors DEFAULT_SETTINGS in src/settings.ts (the xbox preset plus the user preferences
# duration and ignoreReducedMotion); keep the two in sync.
DEFAULT_SETTINGS: Dict[str, Any] = {
    "preset": "xbox",
    "primaryColor": "#107C10",
    "secondaryColor": "#0e6b0e",
    "accentColor": "#52b043",
    "textColor": "#ffffff",
    "descColor": "#a0d9a0",
    "glowEnabled": True,
    "glowIntensity": 20,
    "borderRadius": 12,
    "duration": 6000,
    "iconBorder": True,
    "iconShape": "circle",
    "bannerStyle": "gradient",
    "rarityEffects": True,
    "popupAnimation": True,
    "decorativeElements": "none",
    "entranceStyle": "unfold",
    "shineEnabled": True,
    "ignoreReducedMotion": False,
}


def _is_json_safe(value: Any) -> bool:
    # NaN and Infinity (also 1e999) load as floats, and Decky sends them to the
    # frontend as bare NaN tokens its JSON parser rejects: that call never settles.
    try:
        json.dumps(value, allow_nan=False)
    except (ValueError, RecursionError):
        return False
    return True


class Plugin:
    async def get_settings(self) -> dict:
        if not os.path.exists(SETTINGS_FILE):
            return DEFAULT_SETTINGS.copy()

        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
        # ValueError covers broken JSON and invalid UTF-8.
        except (ValueError, RecursionError, OSError) as error:
            decky.logger.error(f"Failed to load settings, using defaults: {error}")
            return DEFAULT_SETTINGS.copy()

        if not isinstance(saved, dict):
            decky.logger.warning("Settings file did not contain an object, using defaults")
            return DEFAULT_SETTINGS.copy()

        safe = {key: value for key, value in saved.items() if _is_json_safe(value)}
        if len(safe) < len(saved):
            decky.logger.warning("Ignoring settings with NaN or Infinity, using defaults for them")
        return {**DEFAULT_SETTINGS, **safe}

    async def save_settings(self, settings: dict) -> bool:
        if not isinstance(settings, dict):
            decky.logger.warning("Ignoring settings that are not an object")
            return False

        merged = {**DEFAULT_SETTINGS, **settings}
        temp_file = f"{SETTINGS_FILE}.tmp"
        try:
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2, allow_nan=False)
            # Swapped in whole, so a failed or interrupted write never truncates it.
            os.replace(temp_file, SETTINGS_FILE)
        except (OSError, TypeError, ValueError) as error:
            decky.logger.error(f"Failed to save settings: {error}")
            with contextlib.suppress(OSError):
                os.remove(temp_file)
            return False

        # After a plugin reload the Quick Access panel can belong to an older copy of
        # the frontend; this tells the copy that owns the toast hooks about the change.
        try:
            await decky.emit("settings_changed", merged)
        except Exception as error:
            decky.logger.error(f"Failed to announce settings change: {error}")

        return True

    async def get_default_settings(self) -> dict:
        return DEFAULT_SETTINGS.copy()

    async def _main(self):
        decky.logger.info("Achievement Customizer loaded")

    async def _unload(self):
        decky.logger.info("Achievement Customizer unloaded")

    async def _uninstall(self):
        # Decky also runs this when an update replaces the plugin, so the settings
        # file stays put; otherwise every store update would reset the user's theme.
        decky.logger.info("Achievement Customizer uninstalled, settings kept")

    async def _migration(self):
        # The plugin used to be called "Xbox Achievements". Copy (never move) the old
        # settings so rolling back to an older version still finds them.
        if os.path.exists(SETTINGS_FILE):
            return

        candidates = [
            os.path.join(decky.DECKY_HOME, "settings", "Xbox Achievements", "settings.json"),
            os.path.join(decky.DECKY_HOME, "settings", "xbox-achievements", "settings.json"),
            os.path.join(decky.DECKY_HOME, "settings", "xbox-achievements.json"),
        ]

        for src in candidates:
            if os.path.exists(src):
                try:
                    os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
                    shutil.copy2(src, SETTINGS_FILE)
                    decky.logger.info(f"Migrated settings from {src}")
                except OSError as error:
                    decky.logger.error(f"Failed to migrate settings from {src}: {error}")
                return
