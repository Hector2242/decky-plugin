/**
 * @license
 * Palette icon from Font Awesome Free 5.15.4 by @fontawesome
 * (https://fontawesome.com), licensed under CC BY 4.0
 * (https://creativecommons.org/licenses/by/4.0/).
 */

const PALETTE_PATH =
  'M204.3 5C104.9 24.4 24.8 104.3 5.2 203.4c-37 187 131.7 326.4 258.8 306.7 41.2-6.4 61.4-54.6 42.5-91.7-23.1-45.4 9.9-98.4 60.9-98.4h79.7c35.8 0 64.8-29.6 64.9-65.3C511.5 97.1 368.1-26.9 204.3 5zM96 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm32-128c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128-64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm128 64c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z';

/** The plugin's Quick Access tab icon, sized and colored like its label. */
export function PaletteIcon() {
  return (
    <svg
      viewBox="0 0 512 512"
      width="1em"
      height="1em"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
    >
      <path d={PALETTE_PATH} />
    </svg>
  );
}
