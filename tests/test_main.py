"""Backend regression tests: python3 -m unittest discover -s tests (no Decky needed)."""

import asyncio
import importlib.util
import json
import logging
import os
import sys
import tempfile
import time
import types
import unittest
from unittest import mock

ROOT = tempfile.mkdtemp()
HOME = os.path.join(ROOT, "home")
os.makedirs(HOME)


async def _emit(*_args):
    pass


decky = types.ModuleType("decky")
vars(decky).update(
    DECKY_PLUGIN_SETTINGS_DIR=os.path.join(ROOT, "settings"),
    DECKY_HOME=ROOT,
    DECKY_USER_HOME=HOME,
    logger=logging.getLogger("decky-stub"),
    emit=_emit,
)
sys.modules["decky"] = decky
_spec = importlib.util.spec_from_file_location(
    "main", os.path.join(os.path.dirname(__file__), "..", "main.py")
)
assert _spec and _spec.loader
main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(main)
logging.getLogger("decky-stub").disabled = True


def run(coroutine):
    return asyncio.run(coroutine)


# The smallest file _complete_png accepts: PNG signature, padding, IEND chunk.
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 1000 + b"\0\0\0\0IEND\xae\x42\x60\x82"


class BackendTest(unittest.TestCase):
    def setUp(self):
        self.plugin = main.Plugin()
        for name in os.listdir(main.SETTINGS_DIR) if os.path.isdir(main.SETTINGS_DIR) else []:
            os.remove(os.path.join(main.SETTINGS_DIR, name))

    def write_raw(self, text):
        os.makedirs(main.SETTINGS_DIR, exist_ok=True)
        with open(main.SETTINGS_FILE, "w", encoding="utf-8") as f:
            f.write(text)

    def test_missing_corrupt_and_non_object_files_load_defaults(self):
        self.assertEqual(run(self.plugin.get_settings()), main.DEFAULT_SETTINGS)
        for text in ("{nope", "[1]", "", "[" * 100000):
            self.write_raw(text)
            self.assertEqual(run(self.plugin.get_settings()), main.DEFAULT_SETTINGS)

    def test_huge_int_does_not_crash_loading(self):
        # math.isfinite raised OverflowError, so loading failed and the panel's next
        # save replaced everything with defaults.
        self.write_raw(json.dumps({"glowIntensity": 10**400}))
        self.assertEqual(run(self.plugin.get_settings())["glowIntensity"], 10**400)

    def test_save_keeps_what_it_leaves_out(self):
        # An older frontend copy (kept by Decky after an update) saved without newer
        # keys and wiped them; the user's presets were lost that way.
        preset = {"id": "user-1", "name": "Mine", "primaryColor": "#123456"}
        self.assertTrue(run(self.plugin.save_settings({"userPresets": [preset]})))
        self.assertTrue(run(self.plugin.save_settings({"glowEnabled": False})))
        saved = run(self.plugin.get_settings())
        self.assertEqual([p["id"] for p in saved["userPresets"]], ["user-1"])
        self.assertFalse(saved["glowEnabled"])
        self.assertTrue(run(self.plugin.save_settings({"userPresets": []})))
        self.assertEqual(run(self.plugin.get_settings())["userPresets"], [])
        self.assertTrue(run(self.plugin.save_settings(dict(main.DEFAULT_SETTINGS))))
        self.assertEqual(run(self.plugin.get_settings()), main.DEFAULT_SETTINGS)

    def test_bad_presets_are_dropped_one_by_one_and_capped(self):
        good = {"id": "user-1", "name": "Mine", "layout": {"custom": True, "height": 60}}
        bad = [{"id": "user-2", "name": 5}, {"id": "user-3", "layout": "x"}, "x", None]
        run(self.plugin.save_settings({"userPresets": [good, *bad]}))
        presets = run(self.plugin.get_settings())["userPresets"]
        self.assertEqual([p["id"] for p in presets], ["user-1"])
        self.assertEqual(set(presets[0]), set(main.USER_PRESET))
        many = [dict(good, id=f"user-{i}") for i in range(30)]
        run(self.plugin.save_settings({"userPresets": many}))
        self.assertEqual(len(run(self.plugin.get_settings())["userPresets"]), 20)

    def test_interrupted_write_keeps_the_old_file(self):
        run(self.plugin.save_settings({"duration": 9000}))
        with mock.patch.object(main.os, "replace", side_effect=OSError("disk full")):
            self.assertFalse(run(self.plugin.save_settings({"duration": 4000})))
        self.assertEqual(run(self.plugin.get_settings())["duration"], 9000)
        self.assertFalse(os.path.exists(main.SETTINGS_FILE + ".tmp"))

    def test_unwritable_settings_folder_fails_softly(self):
        with mock.patch("builtins.open", side_effect=PermissionError("read-only")):
            self.assertFalse(run(self.plugin.save_settings({"duration": 4000})))

    def test_assets_validate_type_size_and_name(self):
        png = os.path.join(HOME, "cup.PNG")
        with open(png, "wb") as f:
            f.write(PNG)
        name = run(self.plugin.import_asset("trophy", png))
        self.assertRegex(name, r"^trophy-\d+-cup\.png$")
        self.assertTrue(run(self.plugin.get_asset(name)).startswith("data:image/png;base64,"))
        odd = os.path.join(HOME, "../My (gold) trophy!.png")
        os.replace(png, odd)
        name = run(self.plugin.import_asset("trophy", odd))
        self.assertRegex(name, r"^trophy-\d+-My gold trophy\.png$")
        self.assertTrue(run(self.plugin.get_asset(name)))
        big = os.path.join(HOME, "big.wav")
        with open(big, "wb") as f:
            f.write(b"0" * (2 * 1024 * 1024 + 1))
        self.assertEqual(run(self.plugin.import_asset("sound", big)), "")
        self.assertEqual(run(self.plugin.import_asset("sound", png)), "")
        self.assertEqual(run(self.plugin.import_asset("trophy", HOME)), "")
        for bad in ("../settings.json", "trophy-1.svg", None, "trophy-123.png"):
            self.assertEqual(run(self.plugin.get_asset(bad)), "")

    def test_presets_with_unknown_keys_survive(self):
        preset = {**main.LOOK_DEFAULTS, "id": "user-1", "name": "Mine", "removedSetting": True}
        run(self.plugin.save_settings({"userPresets": [preset]}))
        loaded = run(self.plugin.get_settings())["userPresets"]
        self.assertEqual([p["name"] for p in loaded], ["Mine"])
        self.assertNotIn("removedSetting", loaded[0])

    def test_unused_assets_go_after_a_minute(self):
        os.makedirs(main.SETTINGS_DIR, exist_ok=True)
        names = ["trophy-1.png", "trophy-2.png", "trophy-3.png"]
        for name in names:
            with open(os.path.join(main.SETTINGS_DIR, name), "wb") as f:
                f.write(PNG)
        old = time.time() - 120
        for name in names[:2]:
            os.utime(os.path.join(main.SETTINGS_DIR, name), (old, old))
        run(self.plugin.save_settings({"trophyImages": {"gold": "trophy-2.png"}}))
        kept = sorted(n for n in os.listdir(main.SETTINGS_DIR) if n.startswith("trophy"))
        self.assertEqual(kept, ["trophy-2.png", "trophy-3.png"])

    def test_screenshot_failures_and_long_names(self):
        shot = os.path.join(ROOT, "gamescope.png")
        source = os.path.join(ROOT, "source.png")
        with open(source, "wb") as f:
            f.write(PNG)
        with mock.patch.multiple(main, GAMESCOPE_SCREENSHOT=shot, SCREENSHOT_WAIT_SECONDS=0.3):
            with mock.patch.object(main, "SCREENSHOT_REQUEST", ["false"]):
                self.assertEqual(run(self.plugin.take_screenshot("x")), "")
            with mock.patch.object(main, "SCREENSHOT_REQUEST", ["true"]):
                self.assertEqual(run(self.plugin.take_screenshot("x")), "")
            with mock.patch.object(main, "SCREENSHOT_REQUEST", ["cp", source, shot]):
                # A long CJK title went past the 255-byte file name limit.
                path = run(self.plugin.take_screenshot("ゼルダ - " + "実績" * 60 + "/../x"))
                self.assertTrue(os.path.isfile(path))
                self.assertEqual(os.path.dirname(path), os.path.join(HOME, main.SCREENSHOT_FOLDER))
                self.assertLessEqual(len(os.path.basename(path).encode()), 255)


if __name__ == "__main__":
    unittest.main()
