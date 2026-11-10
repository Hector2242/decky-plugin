import asyncio
import base64
import contextlib
import json
import math
import os
import re
import shutil
import time
from typing import Any, Dict

import decky

SETTINGS_DIR = decky.DECKY_PLUGIN_SETTINGS_DIR
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "settings.json")


def _part(x: int, y: int, size: int) -> Dict[str, Any]:
    return {"x": x, "y": y, "size": size, "show": True}


# Mirrors DEFAULT_SETTINGS in src/settings.ts (the xbox preset's look plus the user
# preferences and the user's own presets); keep the two in sync.
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
    "trophyReveal": "spin",
    "popupAnimation": True,
    "decorativeElements": "none",
    "entranceStyle": "unfold",
    "shineEnabled": True,
    "position": "bottom-right",
    "ignoreReducedMotion": True,
    "layout": {
        "custom": False,
        "height": 84,
        "icon": _part(12, 16, 48),
        "badge": _part(72, 10, 12),
        "label": _part(90, 10, 10),
        "title": _part(72, 24, 14),
        "desc": _part(72, 44, 11),
    },
    "labels": {"none": "", "bronze": "", "silver": "", "gold": "", "platinum": ""},
    "trophyImages": {"bronze": "", "silver": "", "gold": "", "platinum": ""},
    "customSound": "",
    "screenshotOnUnlock": False,
    "userPresets": [],
}

# What a preset sets, and what a preset file holds: everything except the user's
# preferences, the preset choice and the saved presets themselves.
NOT_IN_PRESETS = (
    "preset", "duration", "position", "rarityEffects", "trophyReveal",
    "ignoreReducedMotion", "screenshotOnUnlock", "userPresets",
)
LOOK_DEFAULTS: Dict[str, Any] = {
    key: value for key, value in DEFAULT_SETTINGS.items() if key not in NOT_IN_PRESETS
}
# One of the user's presets: a look with its id and name.
USER_PRESET: Dict[str, Any] = {**LOOK_DEFAULTS, "id": "", "name": ""}
MAX_USER_PRESETS = 20


# Longest text any setting holds: colors are 7 characters, labels 40.
MAX_TEXT = 64

# Files a user can import: extension to MIME type, and the size limit in bytes.
ASSET_TYPES: Dict[str, Any] = {
    "trophy": (
        {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".webp": "image/webp", ".gif": "image/gif"},
        1024 * 1024,
    ),
    "sound": ({".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav"}, 2 * 1024 * 1024),
}
# Screenshot on unlock asks gamescope for a picture the way Steam's own screenshot button does;
# 3 is gamescope's full composition: the game with every overlay, the pop-up included. Steam
# only puts the pictures it takes itself into its Media, so these go to Pictures.
SCREENSHOT_REQUEST = [
    "xprop", "-root", "-f", "GAMESCOPECTRL_REQUEST_SCREENSHOT", "32c",
    "-set", "GAMESCOPECTRL_REQUEST_SCREENSHOT", "3",
]
GAMESCOPE_SCREENSHOT = "/tmp/gamescope.png"
SCREENSHOT_FOLDER = os.path.join("Pictures", "Achievement Screenshots")
SCREENSHOT_WAIT_SECONDS = 4.0
SCREENSHOT_LOCK = asyncio.Lock()

# Stored as "<kind>-<milliseconds><extension>" next to settings.json.
# The original name is kept (32 safe characters) so the editor can show it.
ASSET_NAME = re.compile(r"^(trophy|sound)-\d{1,16}(-[A-Za-z0-9._ -]{1,32})?\.[a-z0-9]{2,4}$")


def _is_valid(default: Any, value: Any) -> bool:
    # Each value must have its default's type; objects are checked key by key.
    # Unknown keys (a removed setting, or one from a newer version) are ignored: _fill drops them.
    if isinstance(default, dict):
        return isinstance(value, dict) and all(
            _is_valid(default[key], item) for key, item in value.items() if key in default
        )
    if isinstance(default, list):
        # The user's presets; _fill drops a bad one rather than all of them.
        return isinstance(value, list)
    if isinstance(default, bool):
        return isinstance(value, bool)
    if isinstance(default, (int, float)):
        # NaN and Infinity (also 1e999) load as floats, and Decky sends them to the
        # frontend as bare NaN tokens its JSON parser rejects: that call never settles.
        # An int is always finite, and math.isfinite raises on a huge one.
        if isinstance(value, bool):
            return False
        return isinstance(value, int) or (isinstance(value, float) and math.isfinite(value))
    return isinstance(value, str) and len(value) <= MAX_TEXT


def _known(settings: dict) -> dict:
    return {
        key: value
        for key, value in settings.items()
        if key in DEFAULT_SETTINGS and _is_valid(DEFAULT_SETTINGS[key], value)
    }


def _fill(default: Any, value: Any) -> Any:
    # Fills in what valid but partial settings leave out, inside objects and presets.
    if isinstance(default, dict):
        return {
            key: _fill(sub, value[key]) if key in value else sub
            for key, sub in default.items()
        }
    if isinstance(default, list):
        presets = [item for item in value if _is_valid(USER_PRESET, item)]
        return [_fill(USER_PRESET, item) for item in presets[:MAX_USER_PRESETS]]
    return value


def _store_asset(kind: str, ext: str, data: bytes, label: str = "") -> str:
    """Saves an imported file under a new name that keeps its label; '' on failure."""
    types, limit = ASSET_TYPES[kind]
    if ext not in types or not data or len(data) > limit:
        return ""
    label = re.sub(r"[^A-Za-z0-9._ -]", "", label)[:32].strip(" .-")
    name = f"{kind}-{time.time_ns() // 1_000_000}{'-' + label if label else ''}{ext}"
    try:
        os.makedirs(SETTINGS_DIR, exist_ok=True)
        with open(os.path.join(SETTINGS_DIR, name), "wb") as f:
            f.write(data)
    except OSError as error:
        decky.logger.error(f"Failed to store {kind}: {error}")
        return ""
    return name


def _drop_unused_assets(settings: dict) -> None:
    # Imported files that neither the current look nor any preset uses. Fresh ones
    # are spared: the edit that uses them may not be saved yet.
    used = set()
    for look in (settings, *settings["userPresets"]):
        used.update((*look["trophyImages"].values(), look["customSound"]))
    cutoff = time.time() - 60
    try:
        names = os.listdir(SETTINGS_DIR)
    except OSError:
        return
    for name in names:
        if not ASSET_NAME.match(name) or name in used:
            continue
        path = os.path.join(SETTINGS_DIR, name)
        with contextlib.suppress(OSError):
            if os.path.getmtime(path) < cutoff:
                os.remove(path)


def _complete_png(path: str, since: float) -> bool:
    # gamescope writes the file in place, so check it was written since and is whole.
    try:
        if os.path.getmtime(path) < since - 1 or os.path.getsize(path) < 1000:
            return False
        with open(path, "rb") as f:
            head = f.read(8)
            f.seek(-12, os.SEEK_END)
            tail = f.read(12)
    except OSError:
        return False
    return head == b"\x89PNG\r\n\x1a\n" and tail[4:8] == b"IEND"


def _data_url(name: Any) -> str:
    """Reads a stored file as a data: URL; '' for none or a missing file."""
    if not isinstance(name, str) or not ASSET_NAME.match(name):
        return ""
    types, limit = ASSET_TYPES[name.split("-", 1)[0]]
    mime = types.get(os.path.splitext(name)[1])
    if not mime:
        return ""
    try:
        with open(os.path.join(SETTINGS_DIR, name), "rb") as f:
            data = f.read(limit + 1)
    except OSError as error:
        decky.logger.error(f"Failed to read {name}: {error}")
        return ""
    if len(data) > limit:
        return ""
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def _stored_settings() -> dict:
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

    known = _known(saved)
    if len(known) < len(saved):
        decky.logger.warning("Ignoring unknown or invalid settings, using defaults for them")
    return _fill(DEFAULT_SETTINGS, known)


class Plugin:
    async def get_settings(self) -> dict:
        return _stored_settings()

    async def save_settings(self, settings: dict) -> bool:
        if not isinstance(settings, dict):
            decky.logger.warning("Ignoring settings that are not an object")
            return False

        known = _known(settings)
        if len(known) < len(settings):
            decky.logger.warning("Not saving unknown or invalid settings")
        # What the settings leave out keeps its stored value: an older copy of the
        # frontend, which Decky can keep running after an update, doesn't know newer keys.
        merged = _fill(DEFAULT_SETTINGS, {**_stored_settings(), **known})
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
        _drop_unused_assets(merged)

        # After a plugin reload the Quick Access panel can belong to an older copy of
        # the frontend; this tells the copy that owns the toast hooks about the change.
        try:
            await decky.emit("settings_changed", merged)
        except Exception as error:
            decky.logger.error(f"Failed to announce settings change: {error}")

        return True

    async def get_default_settings(self) -> dict:
        return DEFAULT_SETTINGS.copy()

    async def get_home(self) -> str:
        """Where the file picker starts."""
        return decky.DECKY_USER_HOME

    async def import_asset(self, kind: str, path: str) -> str:
        """Copies a picked image or sound next to the settings; returns its stored name."""
        if kind not in ASSET_TYPES or not isinstance(path, str):
            return ""
        types, limit = ASSET_TYPES[kind]
        ext = os.path.splitext(path)[1].lower()
        if ext not in types:
            return ""
        try:
            with open(path, "rb") as f:
                data = f.read(limit + 1)
        except OSError as error:
            decky.logger.error(f"Failed to read {path}: {error}")
            return ""
        return _store_asset(kind, ext, data, os.path.splitext(os.path.basename(path))[0])

    async def get_asset(self, name: str) -> str:
        return _data_url(name)

    async def take_screenshot(self, name: str) -> str:
        """Saves a picture of the screen, pop-up included, to Pictures; returns its path or ''."""
        async with SCREENSHOT_LOCK:
            with contextlib.suppress(OSError):
                os.remove(GAMESCOPE_SCREENSHOT)
            # Decky's own libraries must not leak into system tools; :0 is Steam's display in
            # Game Mode.
            env = {k: v for k, v in os.environ.items() if k not in ("LD_LIBRARY_PATH", "LD_PRELOAD")}
            env.update(DISPLAY=":0", XDG_RUNTIME_DIR=f"/run/user/{os.getuid()}")
            started = time.time()
            try:
                process = await asyncio.create_subprocess_exec(
                    *SCREENSHOT_REQUEST, env=env,
                    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
                )
                _, error_output = await asyncio.wait_for(process.communicate(), 5)
            except (OSError, asyncio.TimeoutError) as error:
                decky.logger.error(f"Screenshot request failed: {error}")
                return ""
            if process.returncode != 0:
                decky.logger.error(f"Screenshot request failed: {error_output.decode(errors='replace')[-200:]}")
                return ""
            deadline = time.monotonic() + SCREENSHOT_WAIT_SECONDS
            while not _complete_png(GAMESCOPE_SCREENSHOT, started):
                if time.monotonic() > deadline:
                    decky.logger.error("gamescope wrote no screenshot (not in Game Mode?)")
                    return ""
                await asyncio.sleep(0.2)
            title = re.sub(r"[^\w .'()-]+", "", name if isinstance(name, str) else "").strip()
            stamp = time.strftime("%Y-%m-%d %H-%M-%S")
            folder = os.path.join(decky.DECKY_USER_HOME, SCREENSHOT_FOLDER)
            # File names are limited to 255 bytes, and a CJK character takes three.
            title = title.encode()[:180].decode(errors="ignore").strip()
            path = os.path.join(folder, f"{title or 'Achievement'} {stamp}.png")
            try:
                os.makedirs(folder, exist_ok=True)
                shutil.copyfile(GAMESCOPE_SCREENSHOT, path)
            except OSError as error:
                decky.logger.error(f"Failed to save screenshot: {error}")
                return ""
            return path

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
