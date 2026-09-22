import json
import os
import shutil
from typing import Any, Dict

import decky

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

# Mirrors the xbox preset in src/settings.ts; keep the two in sync.
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
}


class Plugin:
    async def get_settings(self) -> dict:
        if not os.path.exists(SETTINGS_FILE):
            return DEFAULT_SETTINGS.copy()

        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
        except (json.JSONDecodeError, OSError) as error:
            decky.logger.error(f"Failed to load settings, using defaults: {error}")
            return DEFAULT_SETTINGS.copy()

        if not isinstance(saved, dict):
            decky.logger.warning("Settings file did not contain an object, using defaults")
            return DEFAULT_SETTINGS.copy()

        return {**DEFAULT_SETTINGS, **saved}

    async def save_settings(self, settings: dict) -> bool:
        if not isinstance(settings, dict):
            decky.logger.warning("Ignoring settings that are not an object")
            return False

        merged = {**DEFAULT_SETTINGS, **settings}
        try:
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2)
        except (OSError, TypeError) as error:
            decky.logger.error(f"Failed to save settings: {error}")
            return False

        return True

    async def get_default_settings(self) -> dict:
        return DEFAULT_SETTINGS.copy()

    async def _main(self):
        decky.logger.info("Achievement Customizer loaded")

    async def _unload(self):
        decky.logger.info("Achievement Customizer unloaded")

    async def _uninstall(self):
        if os.path.exists(SETTINGS_FILE):
            os.remove(SETTINGS_FILE)

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
