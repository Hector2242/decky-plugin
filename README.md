# Achievement Customizer

Achievement Customizer is a [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
plugin that gives your Steam Deck achievement pop-ups the look and feel of a console unlock.
It takes over Steam's own notification right where it appears, so there's nothing to time, unlocks
never show up twice, and the toast you preview in the Quick Access menu is exactly the one you get
in game.

![Achievement Customizer presets](assets/store.png)

## Animations that feel like home

Pick the entrance you grew up with. **Unfold** pops the icon in as an Xbox-style disc, opens the card
out of it and folds it back up when it leaves. **Drop** settles in from above like on a PlayStation,
with a sweep of light around the icon. There's also Slide, Pop, Bounce, Fade, Flip and **Retro**, a
16-bit text box that opens in chunky steps.

Every entrance comes with its own matching exit, and slides always come in from whichever edge of
the screen Steam is showing toasts on.

## Themes

Twelve presets get you started: Xbox, PlayStation, Steam, Nintendo, Gold, Midnight, Sky Day, Sky
Night, Pixel Day, Pixel Night, Cherry Blossom and Halloween. Each one brings its own colors, shape
and entrance.

![Pixel Day, Pixel Night, Cherry Blossom, Halloween, Gold and a progress toast](docs/screenshots/themes.png)

You can also put a little animated scene behind the text, with any theme you like. There's a
simple sparkle overlay, drifting clouds and a warm sun by day, twinkling stars and a crescent moon
by night, and 16-bit pixel versions of both with birds, a shooting star and plenty of sparkle.
Cherry Blossom fills the card with blossoming branches and drifting petals. Halloween is a moonlit
graveyard with bats, ghosts, a twisted old tree and a row of tombstones. The skies are painted from
your Primary and Secondary colors, so if you change them, the whole scene changes with you.

## Rarity and progress

Toasts show what share of players have the achievement. Anything under 25% is called out as
uncommon, under 10% earns a gold ring and glow, and under 1% gets the diamond treatment. When you
make progress on an achievement without unlocking it yet, the toast shows a progress bar instead of
the description.

## Make it yours

![The Achievement Customizer panel in the Quick Access menu](docs/screenshots/quick-access.png)

Everything lives in the Quick Access menu. You can change the primary, secondary, accent, title and
description colors, choose a gradient, solid or glass banner, and tweak the icon shape and border,
corner rounding, glow strength, shine sweep and how long the toast stays on screen.

The preview at the top replays your changes as you make them. The test buttons send real
achievement notifications through Steam, so you see and hear exactly what an unlock will look like
without anything piling up in your notification tray.

If you've turned on Reduce Motion in Steam (Settings › Accessibility), toasts fade gently instead of
moving around. Switch on **Animate anyway** in the plugin if you'd still like the full animations.

## Compatibility

Works in Game Mode on both the stable and beta versions of SteamOS. If you're on the beta, make sure
Decky Loader is on version 3.3.0 or newer, since older versions can't show any plugins there.

## Installation

The plugin hasn't been reviewed or approved by the Decky plugin team yet, so it isn't in the plugin
store. For now it's still in development.

## License

BSD-3-Clause. Built on the [decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template),
and the original template license is kept in `LICENSE`.
