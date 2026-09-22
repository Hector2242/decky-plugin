import { Router, achievementClasses } from "@decky/ui";
import { ThemeSettings, hexToRgbTriplet, sanitizeSettings } from "./settings";
import { buildToastWindowCSS } from "./steam";

const CSS_CLASS_RE = /^[A-Za-z0-9_-]+$/;

function cls(name: string | undefined): string | null {
  return name && CSS_CLASS_RE.test(name) ? `.${name}` : null;
}

// Themes the achievements list to match the toast. Class names come from Steam's
// CSS module map; when a key is missing that rule is skipped rather than guessed.
export function buildAchievementPageCSS(raw: ThemeSettings): string {
  const s = sanitizeSettings(raw);
  const row = cls(achievementClasses?.AchievementListItemBase);
  const image = cls(achievementClasses?.ImageContainer);
  const unlock = cls(achievementClasses?.UnlockContainer);
  const date = cls(achievementClasses?.UnlockDate);
  if (!row) return "";

  const accent = hexToRgbTriplet(s.accentColor);
  const radius = s.iconShape === "circle" ? "50%" : s.iconShape === "rounded" ? "8px" : "0px";
  const background =
    s.bannerStyle === "solid"
      ? s.primaryColor
      : s.bannerStyle === "glass"
        ? `rgb(${hexToRgbTriplet(s.primaryColor)} / 0.8)`
        : `linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor})`;

  return `
    ${row} {
      background: ${background} !important;
      border: 1px solid rgb(${accent} / 0.3) !important;
      border-radius: ${s.borderRadius}px !important;
      margin-bottom: 8px !important;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease !important;
    }
    ${row}:hover, ${row}.gpfocus {
      border-color: ${s.accentColor} !important;
      box-shadow: 0 0 15px rgb(${accent} / 0.4) !important;
      transform: scale(1.02) !important;
    }
    ${image ? `
    ${image} {
      border-radius: ${radius} !important;
      border: 2px solid ${s.accentColor} !important;
      box-shadow: 0 0 12px rgb(${accent} / 0.4) !important;
      overflow: hidden !important;
    }
    ${image} img { border-radius: ${radius} !important; }` : ""}
    ${unlock || date ? `
    ${[unlock, date].filter(Boolean).join(", ")} {
      color: ${s.accentColor} !important;
      font-weight: bold !important;
    }` : ""}
    ${unlock ? `
    ${row}:has(${unlock}) {
      border-color: ${s.accentColor} !important;
      animation: achievement-customizer-glow 3s ease-in-out infinite !important;
    }
    @keyframes achievement-customizer-glow {
      0%, 100% { box-shadow: 0 0 5px rgb(${accent} / 0.4); }
      50% { box-shadow: 0 0 20px rgb(${accent} / 0.6), 0 0 40px rgb(${accent} / 0.4); }
    }` : ""}
  `;
}

const STYLE_ID = "achievement-customizer-main";

// The Gamepad UI main window is a separate document from the shared context
// this plugin runs in, but it is same-origin and Steam exposes it through the
// window store. Writing the <style> directly is synchronous and can be checked
// again whenever it matters, which survives Steam recreating the window.
export function mainDocument(): Document | null {
  try {
    return Router.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow?.document ?? null;
  } catch {
    return null;
  }
}

let currentCSS = "";

export function ensureMainWindowCSS(settings?: ThemeSettings): boolean {
  if (settings) currentCSS = buildAchievementPageCSS(settings) + buildToastWindowCSS();
  const doc = mainDocument();
  if (!doc?.head) return false;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!currentCSS.trim()) {
    style?.remove();
    return true;
  }
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  if (style.textContent !== currentCSS) style.textContent = currentCSS;
  return true;
}

export function removeMainWindowCSS(): void {
  currentCSS = "";
  mainDocument()?.getElementById(STYLE_ID)?.remove();
}
