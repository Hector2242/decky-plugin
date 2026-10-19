/**
 * @fileoverview CSS for Steam's main window: the achievements page theme and
 * the larger toast window.
 */

import {Router, achievementClasses} from '@decky/ui';

import {
  type ThemeSettings,
  hexToRgbTriplet,
  isLightColor,
  relativeLuminance,
  sanitizeSettings,
} from './settings';
import {buildToastWindowCss} from './steam';
import {ICON_RADIUS} from './toast';

const CSS_CLASS_PATTERN = /^[A-Za-z0-9_-]+$/;
const STYLE_ID = 'achievement-customizer-main';

function classSelector(name: string | undefined): string | null {
  return name && CSS_CLASS_PATTERN.test(name) ? `.${name}` : null;
}

function rowBackground(settings: ThemeSettings): string {
  if (settings.bannerStyle === 'solid') return settings.primaryColor;
  if (settings.bannerStyle === 'glass') {
    return `rgb(${hexToRgbTriplet(settings.primaryColor)} / 0.8)`;
  }
  return `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`;
}

// Light rows take the theme's text color; mid-tone rows keep Steam's light
// text and get a shadow behind it.
function rowTextCss(row: string, settings: ThemeSettings): string {
  if (isLightColor(settings.primaryColor)) {
    return `
      ${row} { color: ${settings.textColor} !important; }
      ${row} * { color: inherit !important; }`;
  }
  if (relativeLuminance(settings.primaryColor) > 0.4) {
    return `${row} { text-shadow: 0 1px 2px rgb(0 0 0 / 0.55) !important; }`;
  }
  return '';
}

// Themes the achievements list to match the toast. Class names come from
// Steam's CSS module map; when a key is missing that rule is skipped rather
// than guessed.
function buildAchievementPageCss(rawSettings: ThemeSettings): string {
  const settings = sanitizeSettings(rawSettings);
  const row = classSelector(achievementClasses?.AchievementListItemBase);
  const image = classSelector(achievementClasses?.ImageContainer);
  const unlock = classSelector(achievementClasses?.UnlockContainer);
  const date = classSelector(achievementClasses?.UnlockDate);
  if (!row) return '';

  const accent = hexToRgbTriplet(settings.accentColor);
  const radius = ICON_RADIUS[settings.iconShape];
  const imageCss = image
    ? `
      ${image} {
        border-radius: ${radius} !important;
        border: 2px solid ${settings.accentColor} !important;
        box-shadow: 0 0 12px rgb(${accent} / 0.4) !important;
        overflow: hidden !important;
      }
      ${image} img { border-radius: ${radius} !important; }`
    : '';
  const labels = [unlock, date].filter((selector) => selector !== null);
  const labelCss =
    labels.length > 0
      ? `
      ${labels.join(', ')} {
        color: ${settings.accentColor} !important;
        font-weight: bold !important;
      }`
      : '';
  const unlockedCss = unlock
    ? `
      ${row}:has(${unlock}) {
        border-color: ${settings.accentColor} !important;
        animation: achievement-customizer-glow 3s ease-in-out infinite !important;
      }
      @keyframes achievement-customizer-glow {
        0%, 100% { box-shadow: 0 0 5px rgb(${accent} / 0.4); }
        50% {
          box-shadow: 0 0 20px rgb(${accent} / 0.6), 0 0 40px rgb(${accent} / 0.4);
        }
      }`
    : '';

  return `
    ${row} {
      background: ${rowBackground(settings)} !important;
      border: 1px solid rgb(${accent} / 0.3) !important;
      border-radius: ${settings.borderRadius}px !important;
      margin-bottom: 8px !important;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease !important;
    }
    ${rowTextCss(row, settings)}
    ${row}:hover, ${row}.gpfocus {
      border-color: ${settings.accentColor} !important;
      box-shadow: 0 0 15px rgb(${accent} / 0.4) !important;
      transform: scale(1.02) !important;
    }
    ${imageCss}
    ${labelCss}
    ${unlockedCss}
  `;
}

/**
 * Returns the Gamepad UI main window's document, or null before it exists.
 *
 * It is a separate document from the shared context this plugin runs in, but
 * same-origin, and Steam exposes it through the window store. Writing the
 * `<style>` directly is synchronous and can be checked again whenever it
 * matters, which survives Steam recreating the window.
 */
export function mainDocument(): Document | null {
  try {
    return (
      Router.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow
        ?.document ?? null
    );
  } catch {
    return null;
  }
}

let currentCss = '';

/**
 * Writes the plugin's main-window CSS if it is missing or stale. Passing
 * settings rebuilds the CSS first. Returns false while the window does not
 * exist yet.
 */
export function ensureMainWindowCss(settings?: ThemeSettings): boolean {
  if (settings) {
    currentCss = buildAchievementPageCss(settings) + buildToastWindowCss();
  }
  const windowDocument = mainDocument();
  if (!windowDocument?.head) return false;
  let style: HTMLElement | null = windowDocument.getElementById(STYLE_ID);
  if (!currentCss.trim()) {
    style?.remove();
    return true;
  }
  if (!style) {
    style = windowDocument.createElement('style');
    style.id = STYLE_ID;
    windowDocument.head.appendChild(style);
  }
  if (style.textContent !== currentCss) style.textContent = currentCss;
  return true;
}

/** Removes the plugin's main-window CSS and forgets it. */
export function removeMainWindowCss(): void {
  currentCss = '';
  mainDocument()?.getElementById(STYLE_ID)?.remove();
}
