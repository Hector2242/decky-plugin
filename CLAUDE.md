# CLAUDE.md

This file gives AI coding agents the permanent project context needed to work safely in this repository. Follow it before changing code.

## Project identity

- This repository is a Decky Loader plugin, not Decky Loader itself.
- Plugin name in `plugin.json`: `Achievement Customizer`.
- Package name in `package.json`: `achievement-customizer`.
- Current package version: `2.0.0`.
- Main goal: customize Steam achievement notifications on Steam Deck with themed toast popups, configurable colors, icon styling, glow, animations, rarity effects, and achievement-page styling.
- The plugin was previously named `Xbox Achievements`; migration logic must preserve old user settings.
- Primary runtime target is real Steam Deck hardware in Game Mode. Desktop/browser behavior is not enough proof that a feature works.

## Agent operating rules

- Read `README.md`, `package.json`, `plugin.json`, `main.py`, and `src/index.tsx` before making non-trivial changes.
- Prefer small, focused diffs. Do not rewrite the plugin architecture unless explicitly asked.
- Use `pnpm`, not `npm`, `yarn`, or `bun`, for project installs and builds.
- After frontend changes, run `pnpm run build`.
- Do not run `pnpm test` as a validation step unless you first change the test script; the current script intentionally exits with an error.
- Do not commit generated build folders such as `out/`, `dist/`, or temporary deploy artifacts unless the maintainer explicitly asks.
- Do not remove migration code unless a later version intentionally drops backwards compatibility.
- Do not add broad dependencies for simple UI or settings work. Decky plugins should stay small.
- Be skeptical of Steam UI class names. Many are generated/obfuscated and can change after Steam updates.
- When a selector breaks, debug the live Steam Deck DOM before guessing.

## Development environment

Expected baseline:

```bash
node --version   # Node.js 16.14+ is the Decky template baseline
pnpm --version   # use pnpm v9 for plugin submission compatibility
pnpm i
pnpm run build
```

Useful commands:

```bash
pnpm i                         # install dependencies
pnpm run build                 # build frontend with Rollup
pnpm run watch                 # watch frontend changes locally
pnpm update @decky/ui --latest # use only when Decky UI types/exports are stale
./cli/decky plugin build .     # build deployable plugin zip when Decky CLI is available
```

Steam Deck deployment/checks:

```bash
sudo systemctl restart plugin_loader
journalctl -u plugin_loader -f
# Some Decky setups also expose logs at:
# /var/log/extension/plugin_loader.log
```

If Rollup optional native packages fail after switching Linux environments, remove `node_modules` and reinstall with pnpm instead of mixing package managers.

## Repository map

- `src/index.tsx`: main frontend plugin entry point and most business logic.
- `main.py`: Decky Python backend for persistent settings, defaults, migration, unload, and uninstall hooks.
- `plugin.json`: Decky plugin metadata and store publishing info.
- `package.json`: package metadata, scripts, dependencies, version, and repository info.
- `README.md`: user-facing description, install instructions, feature list, and development commands.
- `LICENSE`: required for plugin distribution.
- `assets/`: plugin images/icons if present.
- `defaults/`, `py_modules/`, `.vscode/`: template/support files if present; do not delete casually.

## Frontend architecture

`src/index.tsx` is a React/TypeScript Decky frontend. It imports Decky UI components from `@decky/ui` and Decky runtime helpers from `@decky/api`.

Important Decky APIs used in this project:

- `definePlugin`: registers the plugin.
- `callable`: calls Python backend methods exposed by `main.py`.
- `toaster.toast`: creates preview/custom toast notifications.
- `injectCssIntoTab` and `removeCssFromTab`: inject/remove CSS in Steam UI webviews.
- `executeInTab`: powerful and brittle; avoid expanding use unless necessary.

Important UI components used:

- `PanelSection`
- `PanelSectionRow`
- `ButtonItem`
- `DropdownItem`
- `SliderField`
- `ToggleField`
- `ColorPickerModal`
- `showModal`

Core types/settings:

- `ThemeSettings` defines the frontend settings contract.
- `PresetName`, `IconShape`, `BannerStyle`, and `DecorativeElements` define allowed UI choices.
- `PRESETS` defines built-in themes.
- `currentSettings` holds active settings in memory.

Whenever settings change:

1. Keep `ThemeSettings` in `src/index.tsx` synchronized with `DEFAULT_SETTINGS` in `main.py`.
2. Keep preset option lists synchronized with the actual presets.
3. Clamp numeric values before using them in CSS.
4. Validate colors before using them in injected CSS.
5. Save only settings that the backend can safely merge and reload.

## Backend architecture

`main.py` exposes the backend `Plugin` class used by Decky.

Current backend responsibilities:

- Store settings in `decky.DECKY_PLUGIN_SETTINGS_DIR/settings.json`.
- Return defaults when settings do not exist.
- Recover cleanly from invalid JSON or invalid settings file shape.
- Merge saved settings over defaults so new fields receive safe defaults.
- Delete the current settings file on uninstall.
- Migrate old settings from prior `Xbox Achievements` paths without deleting old files.

Backend rules:

- Keep backend methods async because Decky calls them that way.
- Avoid shelling out. This plugin does not need arbitrary process execution.
- Avoid network requests unless a feature explicitly requires them.
- Do not store secrets. Theme settings are not secrets.
- Use defensive file IO: handle missing files, invalid JSON, and unexpected types.
- Do not use `decky.migrate_settings()` here unless the maintainer accepts destructive migration; current code intentionally copies old settings so rollback remains possible.

## CSS injection and Steam UI rules

This plugin depends on CSS injection into Steam UI surfaces. Treat that as fragile.

Rules:

- Prefer styling plugin-owned DOM/classes such as `achievement-customizer-*` whenever possible.
- For Steam native UI, isolate generated/obfuscated selectors in clearly named helper functions.
- Never spread random selectors throughout React render code.
- Always remove injected CSS on unload or when replacing an injection.
- Use stable IDs for injected CSS so updates do not leave stale styles behind.
- Do not interpolate unvalidated user strings into CSS.
- Use fallback behavior when native Steam notification styling cannot support full decorative DOM.
- Respect `prefers-reduced-motion` for animated effects.
- Keep animation durations reasonable. Achievement notifications should feel responsive, not like intrusive overlays.

Known fragile areas:

- Native Steam achievement toast class names.
- Achievement page class names.
- Notification webview names such as `notificationtoasts_uid*`.
- CSS selectors relying on `:has()`.
- DOM assumptions inside Steam Big Picture Mode.

If a style only partially applies on Steam Deck, do not guess. Inspect the live webview, identify which wrapper is overriding the style, then patch the narrowest selector.

## Feature behavior expectations

Theme presets:

- Presets should apply complete coherent settings, not only colors.
- Any manual color/style customization should move the preset to `custom` if the UI currently supports that behavior.
- Adding a new preset requires updating `PRESETS`, dropdown options, defaults if applicable, README features, and screenshots/docs if available.

Rarity effects:

- Ultra Rare: under 1% global achievement percentage.
- Rare: under 10%.
- Uncommon: under 25%.
- Effects should degrade gracefully if rarity/global percentage is unavailable.
- Rarity styling should not make text unreadable.

Toast previews:

- Preview toasts should test plugin-owned toast styling.
- Native Steam achievement notifications may use a different DOM. Passing preview does not prove native toast styling works.

Settings:

- Settings must persist across reloads and Deck restarts.
- New settings must have safe defaults in both TypeScript and Python.
- Invalid/corrupt settings should fall back to defaults without crashing the plugin.

Migration:

- Preserve migration from old `Xbox Achievements` settings paths.
- Do not overwrite new settings if they already exist.
- Do not delete old settings during migration.

## Testing workflow

Minimum before declaring work done:

```bash
pnpm run build
```

Manual Steam Deck checks for UI/CSS work:

1. Deploy plugin to `~/homebrew/plugins/` or use Decky CLI deployment.
2. Restart Decky Loader with `sudo systemctl restart plugin_loader`.
3. Open Game Mode and load the Decky sidebar.
4. Open Achievement Customizer.
5. Change each setting touched by the patch.
6. Trigger preview toast.
7. Trigger or inspect a real Steam achievement toast when relevant.
8. Check logs for backend errors.
9. Reload/unload plugin and verify injected CSS is removed.

Manual settings checks:

1. Change settings.
2. Restart plugin loader.
3. Confirm settings persisted.
4. Corrupt `settings.json` intentionally only in a safe dev environment.
5. Confirm backend falls back to defaults and logs an error instead of crashing.

Release/store-readiness checks:

- `package.json` version bumped when preparing a plugin database update.
- `plugin.json` metadata accurate.
- `package.json` author should not remain the template placeholder.
- `README.md` feature list matches actual UI.
- `LICENSE` present in repo root.
- Build output contains required `dist/index.js`.
- If distributing a zip, root must include `package.json`, `plugin.json`, `LICENSE`, and `main.py` because this plugin uses the Python backend/serverAPI style.

## Security and safety rules

- Treat all persisted settings as untrusted input.
- Validate color strings before interpolating into CSS. Prefer strict hex colors unless intentionally supporting more.
- Clamp `duration`, `glowIntensity`, and `borderRadius` before rendering CSS.
- Do not inject user-controlled text into `executeInTab` scripts.
- Do not add file writes outside the Decky plugin settings directory unless explicitly required.
- Do not add telemetry or analytics.
- Do not add network access for theme downloads, remote configs, images, or update checks without explicit maintainer approval.
- Do not request elevated permissions for cosmetic features.

## Code style

TypeScript:

- Use explicit types for settings, callbacks, and Decky/Steam client shapes.
- Prefer small helper functions for CSS generation and settings conversion.
- Keep React component state minimal and synchronized with backend settings.
- Avoid `any`; if Steam internals are unknown, define narrow `Maybe*` interfaces.
- Keep user-facing labels clear and short for Steam Deck UI.

Python:

- Use clear names, simple control flow, and typed dictionaries where practical.
- Keep file IO defensive.
- Log failures with enough detail to debug on Steam Deck.
- Do not turn expected bad settings into hard crashes.

Comments:

- Prefer clear function and variable names over comments.
- Add comments only for non-obvious Decky/Steam behavior, migration reasoning, or fragile selectors.
- Remove stale comments when behavior changes.

## Debugging checklist

When the plugin fails to load:

1. Run `pnpm run build` and fix TypeScript/Rollup errors first.
2. Restart `plugin_loader`.
3. Check `journalctl -u plugin_loader -f`.
4. Check for Python import/runtime errors in `main.py`.
5. Confirm `plugin.json` is valid JSON.
6. Confirm `dist/index.js` exists in the deployed plugin.

When settings do not save:

1. Confirm frontend `callable("save_settings")` matches backend method name.
2. Confirm the backend method is async.
3. Confirm settings path exists or can be created.
4. Check JSON serialization for unsupported values.
5. Confirm frontend and backend settings keys match exactly.

When CSS does not apply:

1. Determine which surface is being styled: preview toast, native notification toast, or achievement page.
2. Confirm CSS was injected into the correct tab/webview.
3. Confirm the selector matches live DOM on the Steam Deck.
4. Check for wrapper elements overriding background, border, overflow, transform, or animation.
5. Remove stale injected CSS before testing a revised selector.
6. Keep the fix narrow.

When Steam updates break styling:

1. Do not assume the plugin logic broke.
2. Reinspect live class names and DOM hierarchy.
3. Update selector helpers only.
4. Preserve plugin-owned classes and settings logic.
5. Document the selector change in the PR/commit message.

## Dependency rules

- Keep `@decky/ui`, `@decky/api`, Rollup, TypeScript, and React type versions compatible with the Decky plugin template.
- Do not add a UI framework. Decky UI already provides Steam-compatible components.
- Do not add state-management libraries for current settings complexity.
- Do not add CSS-in-JS libraries; this plugin already generates targeted CSS strings.
- If dependency updates are needed after Steam/Decky changes, update only what is necessary and verify build output.

## Git and PR rules

- Use descriptive commit messages that state the user-visible change.
- Mention manual Steam Deck testing status honestly.
- Never claim native achievement toasts are fixed unless tested against native Steam notifications, not only preview toasts.
- Include screenshots/GIFs for visible UI changes when possible.
- Keep unrelated cleanup out of feature PRs.

## Claude/Codex memory strategy

- Keep this root `CLAUDE.md` focused on facts needed in every session.
- If the repo grows, add path-specific files instead of making this file enormous:
  - `src/CLAUDE.md` for frontend/CSS injection rules.
  - `backend/CLAUDE.md` if compiled backend code is added later.
  - `.claude/rules/testing.md` for long manual test procedures.
- If another agent uses `AGENTS.md`, either keep both synchronized or make one import/reference the other.

## External references agents should know

- Claude Code project memory: https://code.claude.com/docs/en/memory
- Decky Plugin Template: https://github.com/SteamDeckHomebrew/decky-plugin-template
- Decky Frontend Library: https://github.com/SteamDeckHomebrew/decky-frontend-lib
- Decky Loader: https://github.com/SteamDeckHomebrew/decky-loader
- Decky Plugin Database: https://github.com/SteamDeckHomebrew/decky-plugin-database

## Final rule

This plugin is mostly UI polish on top of fragile Steam/Decky internals. The correct approach is not more code; it is narrower selectors, safer settings, cleaner unload behavior, and honest Steam Deck testing.
