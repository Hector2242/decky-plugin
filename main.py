import json
import os
import shutil
from typing import Any, Dict

import decky

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

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
        merged = {**DEFAULT_SETTINGS, **settings}
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)

        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)

        return True

    async def get_default_settings(self) -> dict:
        return DEFAULT_SETTINGS.copy()

    async def _main(self):
        decky.logger.info("Achievement Customizer plugin loaded")

    async def _unload(self):
        decky.logger.info("Achievement Customizer plugin unloaded")

    async def _uninstall(self):
        if os.path.exists(SETTINGS_FILE):
            os.remove(SETTINGS_FILE)

    async def _migration(self):
        # Non-destructive migration: copy settings from the pre-rename location into the
        # current DECKY_PLUGIN_SETTINGS_DIR. We intentionally do NOT use decky.migrate_settings()
        # because it removes the old locations; we leave the old files in place so a user who
        # rolls back to a prior plugin version still has their data.
        new_settings = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
        if os.path.exists(new_settings):
            decky.logger.info(
                f"Settings already present at {new_settings}, skipping migration"
            )
            return

        candidates = [
            # Directory form — display name (path used before the rename to Achievement Customizer)
            os.path.join(decky.DECKY_HOME, "settings", "Xbox Achievements", "settings.json"),
            # Directory form — kebab-case
            os.path.join(decky.DECKY_HOME, "settings", "xbox-achievements", "settings.json"),
            # Legacy single-file path (what the original _migration targeted)
            os.path.join(decky.DECKY_HOME, "settings", "xbox-achievements.json"),
        ]

        for src in candidates:
            if os.path.exists(src):
                os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
                shutil.copy2(src, new_settings)
                decky.logger.info(f"Migrated settings from {src} to {new_settings}")
                return

        decky.logger.info("No prior settings found to migrate")