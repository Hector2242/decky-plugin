# Xbox Achievements

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin for Steam Deck that replaces the default Steam achievement notifications with customizable, Xbox-style toast popups.

Built starting from the [decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template) and evolved into a fully featured achievement notification customizer.

## Features

- **Theme Presets** - Xbox, PlayStation, Steam, Nintendo, Gold, and Midnight themes out of the box
- **Full Color Customization** - Pick your own colors for primary, secondary, accent, title text, and description text
- **Banner Styles** - Choose between gradient, solid, or glass (blur) backgrounds
- **Icon Styling** - Circle, rounded, or square icon shapes with optional glowing borders
- **Glow Effects** - Configurable glow intensity around notifications
- **Rarity Effects** - Special animated effects based on achievement rarity:
  - Ultra Rare (< 1%) - Diamond cyan glow with pulsing animation
  - Rare (< 10%) - Gold glow with pulsing animation
  - Uncommon (< 25%) - Subtle shimmer effect
- **Achievement Page Styling** - Themes carry over to the achievement list page
- **Adjustable Duration** - Control how long notifications stay on screen (3-15 seconds)
- **Live Preview** - See your theme changes instantly with test notifications
- **Persistent Settings** - Your theme choices are saved and restored between sessions

## Installation

Install via the Decky Plugin Store, or manually:

1. Download the latest release
2. Extract into `~/homebrew/plugins/`
3. Restart Decky Loader

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

## License

BSD-3-Clause
