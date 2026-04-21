# Achievement Customizer

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin for Steam Deck that replaces Steam's default achievement toast notifications with fully customizable, themed popups. Ships with presets inspired by other consoles and storefronts, plus complete color and effect control.

> Previously named *Xbox Achievements*. Renamed in 2.0.0 — existing user settings are migrated automatically on first load.

## Features

- **Theme Presets** — Xbox, PlayStation, Steam, Nintendo, Gold, and Midnight out of the box
- **Full Color Customization** — Primary, secondary, accent, title text, and description text
- **Banner Styles** — Gradient, solid, or glass (blur) backgrounds
- **Icon Styling** — Circle, rounded, or square icon shapes with optional glowing borders
- **Glow Effects** — Configurable glow intensity around notifications
- **Rarity Effects** — Special animated effects based on achievement rarity:
  - Ultra Rare (< 1%) — Diamond cyan glow with pulsing animation
  - Rare (< 10%) — Gold glow with pulsing animation
  - Uncommon (< 25%) — Subtle shimmer
- **Achievement Page Styling** — Themes carry over to the achievements list page
- **Adjustable Duration** — Control how long notifications stay on screen (3–15s)
- **Live Preview** — See theme changes instantly with test notifications
- **Persistent Settings** — Choices are saved and restored between sessions

## Screenshots

*(Screenshots / GIFs will be added here.)*

## Installation

Install via the Decky Plugin Store, or manually:

1. Download the latest release from the GitHub releases page
2. Extract into `~/homebrew/plugins/` on your Steam Deck
3. Restart Decky Loader (`sudo systemctl restart plugin_loader`)
4. Open the Decky sidebar and select **Achievement Customizer**

## Configuration

Open the plugin panel from the Decky sidebar. Every change applies live — no restart needed.

- **Preset** — Apply a complete theme with one click. Any color change automatically switches the preset to *Custom*.
- **Colors** — Individually set Primary, Secondary, Accent, Title Text, and Description Text colors.
- **Style** — Banner style (gradient / solid / glass), icon shape, icon border, and toast corner rounding.
- **Effects** — Pop-up animation, glow effect + intensity, and rarity-based effects.
- **Timing** — Notification display duration.
- **Reset** — Restore factory defaults.

Settings persist at `~/homebrew/settings/Achievement Customizer/settings.json`.

## Development

### Dependencies

- Node.js v16.14+
- pnpm v9

```bash
sudo npm i -g pnpm@9
```

### Build

```bash
pnpm i
pnpm run build
```

To build a deployable zip, use the Decky CLI (installed via `.vscode/setup.sh`):

```bash
./cli/decky plugin build .
```

## Credits

Built on the [decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template) by the Steam Deck Homebrew project. The template's BSD-3-Clause license is preserved in the `LICENSE` file at the repo root.

## License

BSD-3-Clause
