import { CSSProperties, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Decoration, EntranceStyle, ThemeSettings, hexToRgbTriplet, sanitizeSettings } from "./settings";

export interface ToastAchievement {
  appid: number;
  id: string;
  name: string;
  description: string;
  image: string;
  achieved: boolean;
  /** Global unlock percentage, 0-100. Zero or negative means unknown. */
  globalPct: number;
  progress?: { min: number; current: number; max: number };
}

export interface ToastEdge {
  top: boolean;
  left: boolean;
  inGame: boolean;
}

export type RarityTier = "none" | "uncommon" | "rare" | "ultra";

interface Props {
  achievement: ToastAchievement;
  settings: ThemeSettings;
  /** "live" positions the card inside Steam's toast popup and plays the exit; "preview" flows inline. */
  mode: "live" | "preview";
  /** Resolves which screen edges the toast popup is anchored to, so entrances come from the right side. */
  edgeOf?: (root: HTMLElement) => ToastEdge;
  onActivate?: () => void;
}

export function rarityTier(globalPct: number, enabled: boolean): RarityTier {
  if (!enabled || !(globalPct > 0)) return "none";
  if (globalPct < 1) return "ultra";
  if (globalPct < 10) return "rare";
  if (globalPct < 25) return "uncommon";
  return "none";
}

const UNLOCK_LABEL: Record<RarityTier, string> = {
  none: "Achievement unlocked",
  uncommon: "Uncommon unlock",
  rare: "Rare achievement",
  ultra: "Ultra rare unlock",
};

function formatPct(pct: number): string {
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

function formatCount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(n) ? 0 : 1 });
}

function iconRadius(shape: ThemeSettings["iconShape"]): string {
  return shape === "circle" ? "50%" : shape === "rounded" ? "8px" : "0px";
}

function hasSkyBackground(d: Decoration): boolean {
  return d === "sky-day" || d === "sky-night";
}

const BADGE_PATH =
  "M30 30.05H26L24 34.05L20.11 27.57L22.9 24.8701L26.9 24.81L30 30.05ZM13.1 24.8701L9.1 24.81L6 30.05H10L12 34.05L15.89 27.57L13.1 24.8701ZM22.5 13.05C22.5 12.16 22.2361 11.29 21.7416 10.55C21.2471 9.80996 20.5443 9.23318 19.7221 8.89259C18.8998 8.552 17.995 8.46288 17.1221 8.63651C16.2492 8.81015 15.4474 9.23873 14.818 9.86807C14.1887 10.4974 13.7601 11.2992 13.5865 12.1721C13.4128 13.0451 13.5019 13.9499 13.8425 14.7721C14.1831 15.5944 14.7599 16.2972 15.4999 16.7917C16.24 17.2861 17.11 17.55 18 17.55C18.5913 17.5514 19.1771 17.4359 19.7236 17.2102C20.2702 16.9845 20.7668 16.6531 21.1849 16.235C21.603 15.8168 21.9345 15.3202 22.1601 14.7737C22.3858 14.2271 22.5013 13.6414 22.5 13.05ZM29 13.05L25.85 16.3L25.78 20.83L21.25 20.9L18 24.05L14.75 20.9L10.22 20.83L10.15 16.3L7 13.05L10.15 9.80005L10.22 5.27005L14.75 5.20005L18 2.05005L21.25 5.20005L25.78 5.27005L25.85 9.80005L29 13.05Z";

function Badge() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d={BADGE_PATH} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Decorations

const SPARKLES = [
  { top: "18%", left: "16%", size: 10, delay: 0, duration: 2.4 },
  { top: "64%", left: "12%", size: 7, delay: 0.9, duration: 2.8 },
  { top: "34%", left: "27%", size: 6, delay: 1.7, duration: 2.2 },
  { top: "78%", left: "33%", size: 9, delay: 0.45, duration: 3.0 },
  { top: "12%", left: "43%", size: 8, delay: 1.3, duration: 2.6 },
  { top: "70%", left: "51%", size: 6, delay: 2.1, duration: 2.4 },
  { top: "26%", left: "58%", size: 12, delay: 0.7, duration: 3.2 },
  { top: "80%", left: "66%", size: 7, delay: 1.55, duration: 2.5 },
  { top: "20%", left: "74%", size: 9, delay: 2.35, duration: 2.9 },
  { top: "58%", left: "80%", size: 8, delay: 1.05, duration: 2.7 },
];

const STARS = [
  [2, 10, 5, 0, 2.5], [3, 24, 16, 0.3, 2.5], [2, 78, 9, 0.7, 2.5], [2, 55, 22, 1.2, 2.5],
  [4, 12, 31, 1.8, 2.5], [2, 83, 28, 0.5, 2.5], [2, 8, 42, 1.5, 2.5], [3, 85, 48, 0.9, 2.5],
  [2, 16, 54, 0.4, 1.8], [2, 74, 59, 1.1, 2.5], [2, 10, 65, 0.8, 3.5], [3, 81, 71, 1.6, 2.5],
  [2, 20, 77, 0.2, 2.5], [2, 68, 83, 1.9, 1.8], [3, 12, 89, 0.6, 3.5], [2, 86, 93, 1.3, 2.5],
];

const CONSTELLATION_PATH =
  "M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688Z";

const CONSTELLATIONS = [
  { top: "15%", left: "12%", width: 8, opacity: 0.7 },
  { top: "62%", left: "36%", width: 6, opacity: 0.4 },
  { top: "26%", left: "58%", width: 10, opacity: 0.8 },
  { top: "67%", left: "80%", width: 7, opacity: 0.5 },
];

function ConstellationHalf() {
  return (
    <div className="ac-drift-half">
      {CONSTELLATIONS.map((c, i) => (
        <svg key={i} className="ac-constellation" viewBox="133 0 8 9" style={{ top: c.top, left: c.left, width: c.width, opacity: c.opacity }}>
          <path d={CONSTELLATION_PATH} />
        </svg>
      ))}
    </div>
  );
}

function SkyLayer({ variant }: { variant: Decoration }) {
  if (variant === "sparkles") {
    return (
      <div className="ac-sky">
        {SPARKLES.map((_, i) => (
          <div key={i} className={`ac-sparkle ac-sparkle-${i + 1}`} />
        ))}
      </div>
    );
  }
  if (variant === "sky-day") {
    return (
      <div className="ac-sky">
        <div className="ac-sun" />
        <svg className="ac-birds" viewBox="0 0 60 20" width="40" height="20">
          <path d="M2 10 Q 7 2 12 10 Q 17 2 22 10" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 15 Q 30 7 35 15 Q 40 7 45 15" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-back">
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
          </div>
        </div>
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-front">
            <div className="ac-drift-half"><div className="ac-cloud-1" /><div className="ac-cloud-2" /></div>
            <div className="ac-drift-half"><div className="ac-cloud-1" /><div className="ac-cloud-2" /></div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === "sky-night") {
    return (
      <div className="ac-sky">
        <div className="ac-moon" />
        {STARS.map((_, i) => (
          <div key={i} className={`ac-star ac-star-${i + 1}`} />
        ))}
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-stars">
            <ConstellationHalf />
            <ConstellationHalf />
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSS

const ENTRANCE_TIMING: Record<EntranceStyle, [string, string]> = {
  pop: ["600ms", "cubic-bezier(0.34, 1.56, 0.64, 1)"],
  slide: ["480ms", "cubic-bezier(0.22, 1, 0.36, 1)"],
  fade: ["450ms", "ease-out"],
  bounce: ["800ms", "cubic-bezier(0.28, 0.84, 0.42, 1)"],
  unfold: ["1000ms", "cubic-bezier(0.25, 0.8, 0.3, 1)"],
  drop: ["560ms", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
};

function entranceCSS(style: EntranceStyle): string {
  const [ms, ease] = ENTRANCE_TIMING[style];
  const rule = `.ac-in-${style} { animation-name: ac-in-${style}; animation-duration: ${ms}; animation-timing-function: ${ease}; }`;
  switch (style) {
    case "slide":
      return `
        ${rule}
        @keyframes ac-in-slide { from { opacity: 0; transform: translateX(calc(var(--ac-dx) * 64px)); } to { opacity: 1; transform: none; } }`;
    case "fade":
      return `
        ${rule}
        @keyframes ac-in-fade { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }`;
    case "bounce":
      return `
        ${rule}
        @keyframes ac-in-bounce {
          0%   { opacity: 0; transform: scale(0.5) translateY(-18px); }
          40%  { opacity: 1; transform: scale(1.06); }
          58%  { transform: scale(0.95) translateY(-7px); }
          76%  { transform: scale(1.03); }
          88%  { transform: scale(0.99) translateY(-2px); }
          100% { opacity: 1; transform: none; }
        }`;
    case "unfold":
      // Xbox style: the icon disc pops in, holds, then the card unfolds out of it.
      // Negative insets at the end keep the glow inside the clip.
      return `
        ${rule}
        .ac-in-unfold { transform-origin: 36px 50%; }
        .ac-in-unfold .ac-text { animation: ac-text-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) 520ms both; }
        @keyframes ac-in-unfold {
          0%   { opacity: 0; transform: scale(0.4); clip-path: inset(calc(50% - 36px) calc(100% - 72px) calc(50% - 36px) 0 round 36px); }
          18%  { opacity: 1; transform: scale(1.08); }
          28%  { transform: none; }
          48%  { clip-path: inset(calc(50% - 36px) calc(100% - 72px) calc(50% - 36px) 0 round 36px); }
          100% { clip-path: inset(-48px -48px -48px -48px round var(--ac-radius)); }
        }
        @keyframes ac-text-in { from { opacity: 0; transform: translateX(-10px); } }`;
    case "drop":
      // PlayStation style: settles down from above, with one pass of light around the icon.
      return `
        ${rule}
        .ac-in-drop .ac-ring { opacity: 1; background: conic-gradient(from 0deg, transparent 0 62%, rgb(255 255 255 / 0.85) 82%, transparent 100%); animation: ac-spin-once 1.1s ease-out 350ms both; }
        @keyframes ac-in-drop {
          0%   { opacity: 0; transform: translateY(-26px) scale(0.96); }
          65%  { opacity: 1; transform: translateY(3px); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes ac-spin-once { from { transform: rotate(0turn); opacity: 1; } to { transform: rotate(1turn); opacity: 0; } }`;
    default:
      return `
        ${rule}
        @keyframes ac-in-pop {
          0%   { opacity: 0; transform: scale(0.3); border-radius: 50%; }
          40%  { opacity: 1; transform: scale(1.05); border-radius: calc(var(--ac-radius) * 2); }
          70%  { transform: scale(0.97); border-radius: var(--ac-radius); }
          100% { opacity: 1; transform: none; border-radius: var(--ac-radius); }
        }`;
  }
}

function backgroundCSS(s: ThemeSettings): string {
  if (s.decorativeElements === "sky-day") return "background: linear-gradient(160deg, #5EA6D6 0%, #3D7EAE 100%);";
  if (s.decorativeElements === "sky-night") return "background: linear-gradient(160deg, #2A2D3E 0%, #1D1F2C 100%);";
  if (s.bannerStyle === "solid") return "background: var(--ac-primary);";
  if (s.bannerStyle === "glass") {
    return "background: rgb(var(--ac-primary-rgb) / 0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);";
  }
  return "background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));";
}

// Rare tiers add a box-shadow pulse next to the entrance, so the entrance has to
// be restated here: this selector outranks the .ac-in-* one.
function rarityCSS(tier: RarityTier, enter: { name: string; ms: string; ease: string } | null): string {
  const list = (pulse: string, ms: string) => enter
    ? `animation-name: ${enter.name}, ${pulse}; animation-duration: ${enter.ms}, ${ms}; animation-timing-function: ${enter.ease}, ease-in-out; animation-delay: 0s, 900ms; animation-iteration-count: 1, infinite; animation-fill-mode: both, none;`
    : `animation: ${pulse} ${ms} ease-in-out 900ms infinite;`;
  if (tier === "rare") {
    return `
      .ac-rare .ac-card { border-color: #FFD700; ${list("ac-pulse-rare", "2.5s")} }
      .ac-rare .ac-pill { background: rgb(255 215 0 / 0.18); color: #FFD700; }
      .ac-rare .ac-ring { opacity: 1; background: conic-gradient(from 0deg, transparent 0 55%, #FFD700 80%, transparent 100%); animation: ac-spin 2.6s linear infinite; }
      @keyframes ac-pulse-rare {
        0%, 100% { box-shadow: 0 0 14px rgb(255 215 0 / 0.5), 0 0 30px rgb(255 165 0 / 0.2), 0 6px 18px rgb(0 0 0 / 0.35); }
        50%      { box-shadow: 0 0 22px rgb(255 215 0 / 0.75), 0 0 48px rgb(255 165 0 / 0.4), 0 6px 18px rgb(0 0 0 / 0.35); }
      }`;
  }
  if (tier === "ultra") {
    return `
      .ac-ultra .ac-card { border-color: #E5E4E2; ${list("ac-pulse-ultra", "2s")} }
      .ac-ultra .ac-pill { background: rgb(229 228 226 / 0.22); color: #F4FAFF; }
      .ac-ultra .ac-ring { opacity: 1; background: conic-gradient(from 0deg, transparent 0 50%, #7FF6FF 72%, #E5E4E2 84%, transparent 100%); animation: ac-spin 2.2s linear infinite; }
      @keyframes ac-pulse-ultra {
        0%, 100% { box-shadow: 0 0 14px rgb(229 228 226 / 0.55), 0 0 30px rgb(0 255 255 / 0.25), 0 6px 18px rgb(0 0 0 / 0.35); }
        50%      { box-shadow: 0 0 24px rgb(0 255 255 / 0.65), 0 0 52px rgb(229 228 226 / 0.4), 0 6px 18px rgb(0 0 0 / 0.35); }
      }`;
  }
  return "";
}

function skyCSS(variant: Decoration): string {
  if (variant === "none") return "";
  const base = `
    .ac-sky { position: absolute; inset: 0; overflow: hidden; border-radius: calc(var(--ac-radius) - 2px); pointer-events: none; z-index: 0; }
    .ac-drift { position: absolute; inset: 0; overflow: hidden; }
    .ac-drift-track { display: flex; width: 200%; height: 100%; }
    .ac-drift-half { width: 50%; height: 100%; position: relative; }
    @keyframes ac-drift-left { to { transform: translateX(-50%); } }
    .ac-compact .ac-sun, .ac-compact .ac-moon { top: 18px; }`;

  if (variant === "sparkles") {
    const each = SPARKLES.map(
      (sp, i) =>
        `.ac-sparkle-${i + 1} { top: ${sp.top}; left: ${sp.left}; width: ${sp.size}px; height: ${sp.size}px; animation-delay: ${sp.delay}s; animation-duration: ${sp.duration}s; }`,
    ).join("\n");
    return `${base}
      .ac-sparkle { position: absolute; background: var(--ac-accent); clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%); opacity: 0; box-shadow: 0 0 6px rgb(var(--ac-accent-rgb) / 0.67); animation: ac-sparkle 2.5s ease-in-out infinite; }
      ${each}
      @keyframes ac-sparkle { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(0deg); } 35% { opacity: 1; transform: scale(1) rotate(25deg); } 65% { opacity: 0.85; transform: scale(0.9) rotate(35deg); } }`;
  }

  if (variant === "sky-day") {
    return `${base}
      .ac-sun { position: absolute; top: 26px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: #ECCA2F; box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.6), inset 0 -1px 2px rgb(161 135 42 / 0.5), 0 0 12px rgb(236 202 47 / 0.35); animation: ac-sun 4s ease-in-out infinite; }
      @keyframes ac-sun { 50% { box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.6), inset 0 -1px 2px rgb(161 135 42 / 0.5), 0 0 18px rgb(236 202 47 / 0.7); } }
      .ac-birds { position: absolute; top: 22%; left: 40%; opacity: 0.5; }
      .ac-cloud-1, .ac-cloud-2, .ac-cloud-3 { position: absolute; border-radius: 50%; }
      .ac-cloud-1 { width: 26px; height: 26px; background: #F3FDFF; top: 82%; left: 4%; box-shadow: 20px -6px 0 7px #F3FDFF, 44px 3px 0 -3px #F3FDFF, -15px 5px 0 -5px #F3FDFF; }
      .ac-cloud-2 { width: 32px; height: 32px; background: #F3FDFF; top: 80%; left: 55%; box-shadow: 24px 7px 0 -3px #F3FDFF, 48px -5px 0 5px #F3FDFF, -21px 9px 0 -7px #F3FDFF, 69px 9px 0 -6px #F3FDFF; }
      .ac-cloud-3 { width: 28px; height: 28px; background: #AACADF; top: 74%; left: 28%; box-shadow: 27px -5px 0 4px #AACADF, 57px 7px 0 -3px #AACADF, -24px 7px 0 -6px #AACADF, 81px -3px 0 5px #AACADF, 111px 6px 0 -5px #AACADF; }
      .ac-drift-back { animation: ac-drift-left 30s linear infinite; opacity: 0.7; }
      .ac-drift-front { animation: ac-drift-left 20s linear infinite; opacity: 0.9; }
      .ac-title, .ac-desc { text-shadow: 0 1px 3px rgb(25 60 90 / 0.7), 0 0 6px rgb(25 60 90 / 0.35); }`;
  }

  const stars = STARS.map(
    ([size, top, left, delay, dur], i) =>
      `.ac-star-${i + 1} { width: ${size}px; height: ${size}px; top: ${top}%; left: ${left}%; animation-delay: ${delay}s; animation-duration: ${dur}s; }`,
  ).join("\n");
  return `${base}
    .ac-moon { position: absolute; top: 26px; right: 11px; width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 76% 41%, #2A2D3E 44%, transparent 45%), radial-gradient(circle, #C4C9D1 100%, transparent 100%); box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.5); animation: ac-moon 5s ease-in-out infinite; }
    @keyframes ac-moon { 50% { filter: drop-shadow(0 0 5px rgb(255 255 255 / 0.45)); } }
    .ac-star { position: absolute; background: #fff; border-radius: 50%; box-shadow: 0 0 4px rgb(255 255 255 / 0.85); animation: ac-twinkle 2.5s ease-in-out infinite alternate; }
    ${stars}
    @keyframes ac-twinkle { from { opacity: 0.25; transform: scale(0.7); } to { opacity: 1; transform: scale(1.25); } }
    .ac-constellation { position: absolute; fill: #fff; }
    .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }
    .ac-title, .ac-desc { text-shadow: 0 0 8px rgb(20 22 35 / 0.9), 0 1px 3px rgb(0 0 0 / 0.6); }`;
}

export function buildToastCSS(s: ThemeSettings, tier: RarityTier): string {
  const glowPx = Math.min(24, Math.max(4, s.glowIntensity));
  const glowAlpha = (0.3 + s.glowIntensity / 100).toFixed(2);
  const shadow = s.glowEnabled
    ? `0 0 ${glowPx}px rgb(var(--ac-accent-rgb) / ${glowAlpha}), 0 0 ${glowPx * 2}px rgb(var(--ac-accent-rgb) / 0.25), 0 6px 18px rgb(0 0 0 / 0.35)`
    : "0 6px 18px rgb(0 0 0 / 0.35)";
  const intenseShine = tier === "rare" || tier === "ultra";
  const [enterMs, enterEase] = ENTRANCE_TIMING[s.entranceStyle];

  return `
    .ac-toast { --ac-dx: 1; position: absolute !important; left: -6px; right: 14px; top: 50%; translate: 0 -50%; margin: 0; font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif; -webkit-font-smoothing: antialiased; animation: ac-out 300ms ease-in var(--toast-duration, 6000ms) forwards !important; }
    .ac-toast[data-edge~="left"] { --ac-dx: -1; }
    .ac-toast[data-edge~="ingame"] { top: auto; bottom: 58px; translate: none; }
    .ac-toast[data-edge~="ingame"][data-edge~="top"] { top: 38px; bottom: auto; }
    .ac-toast.ac-preview { position: relative !important; left: auto; right: auto; top: auto; translate: none; width: 100%; animation: none !important; }
    @keyframes ac-out { to { opacity: 0; transform: translateX(calc(var(--ac-dx) * 20px)); } }

    .ac-card { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 10px 12px; box-sizing: border-box; border: 2px solid var(--ac-accent); border-radius: var(--ac-radius); ${backgroundCSS(s)} box-shadow: ${shadow}; color: var(--ac-text); isolation: isolate; animation-fill-mode: both; }
    .ac-compact .ac-card { min-height: 0; padding: 6px 10px; gap: 10px; }
    ${s.popupAnimation ? entranceCSS(s.entranceStyle) : ""}

    .ac-icon { position: relative; z-index: 1; flex: 0 0 48px; width: 48px; height: 48px; border-radius: var(--ac-icon-radius); }
    .ac-compact .ac-icon { flex-basis: 40px; width: 40px; height: 40px; }
    .ac-icon img, .ac-icon-fallback { display: block; width: 100%; height: 100%; box-sizing: border-box; border-radius: inherit; object-fit: cover; background: rgb(0 0 0 / 0.3); border: ${s.iconBorder ? "2px solid var(--ac-accent)" : "0"}; box-shadow: ${s.iconBorder ? "0 0 8px rgb(var(--ac-accent-rgb) / 0.4)" : "none"}; }
    .ac-icon-fallback { display: flex; align-items: center; justify-content: center; color: var(--ac-accent); }
    .ac-icon-fallback svg { width: 60%; height: 60%; fill: currentColor; }
    .ac-ring { position: absolute; inset: -4px; border-radius: calc(var(--ac-icon-radius) + 4px); padding: 2px; opacity: 0; pointer-events: none; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
    @keyframes ac-spin { to { transform: rotate(1turn); } }

    .ac-text { position: relative; z-index: 1; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .ac-sky-space .ac-title, .ac-sky-space .ac-desc, .ac-sky-space .ac-progress { padding-right: 34px; }
    .ac-eyebrow { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 10px; line-height: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ac-accent); }
    .ac-eyebrow svg { flex: 0 0 auto; width: 12px; height: 12px; fill: currentColor; }
    .ac-eyebrow-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ac-pill { margin-left: auto; flex: 0 0 auto; padding: 1px 6px; border-radius: 999px; font-size: 9px; line-height: 12px; letter-spacing: 0.06em; white-space: nowrap; background: rgb(var(--ac-accent-rgb) / 0.18); color: var(--ac-accent); }
    .ac-pill.ac-pct { padding: 0; background: none; color: var(--ac-desc); opacity: 0.85; }
    .ac-title { font-size: 14px; line-height: 17px; font-weight: 600; color: var(--ac-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ac-desc { font-size: 11px; line-height: 14px; color: var(--ac-desc); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ac-compact .ac-desc { -webkit-line-clamp: 1; }
    .ac-progress { display: flex; align-items: center; gap: 8px; font-size: 11px; line-height: 14px; color: var(--ac-desc); }
    .ac-bar { flex: 1 1 auto; height: 6px; border-radius: 3px; background: rgb(var(--ac-accent-rgb) / 0.22); overflow: hidden; }
    .ac-fill { height: 100%; border-radius: inherit; background: var(--ac-accent); transform-origin: left; animation: ac-fill 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 350ms both; }
    .ac-count { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
    @keyframes ac-fill { from { transform: scaleX(0); } }

    ${s.shineEnabled ? `
    .ac-card::after { content: ""; position: absolute; inset: 0; z-index: 2; border-radius: inherit; pointer-events: none; opacity: 0; background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / ${intenseShine ? 0.5 : 0.28}) 50%, transparent 65%); background-size: 300% 100%; background-repeat: no-repeat; animation: ac-shine ${intenseShine ? "1100ms" : "900ms"} ease-in-out 300ms ${intenseShine ? 2 : 1} both; }
    @keyframes ac-shine { 0% { background-position: 150% 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { background-position: -150% 0; opacity: 0; } }` : ""}

    ${skyCSS(s.decorativeElements)}
    ${rarityCSS(tier, s.popupAnimation ? { name: `ac-in-${s.entranceStyle}`, ms: enterMs, ease: enterEase } : null)}

    @media (prefers-reduced-motion: reduce) {
      .ac-card, .ac-card::after, .ac-text, .ac-icon, .ac-ring, .ac-fill, .ac-sky * { animation: none !important; }
      .ac-card { opacity: 1; transform: none; clip-path: none; }
      .ac-card::after { opacity: 0; }
    }
  `;
}

function cssTokens(s: ThemeSettings): CSSProperties {
  const tokens: Record<string, string> = {
    "--ac-primary": s.primaryColor,
    "--ac-primary-rgb": hexToRgbTriplet(s.primaryColor),
    "--ac-secondary": s.secondaryColor,
    "--ac-accent": s.accentColor,
    "--ac-accent-rgb": hexToRgbTriplet(s.accentColor),
    "--ac-text": s.textColor,
    "--ac-desc": s.descColor,
    "--ac-radius": `${s.borderRadius}px`,
    "--ac-icon-radius": iconRadius(s.iconShape),
  };
  return tokens as CSSProperties;
}

// ---------------------------------------------------------------------------
// Component

export function AchievementToast({ achievement: a, settings: raw, mode, edgeOf, onActivate }: Props) {
  const s = useMemo(() => sanitizeSettings(raw), [raw]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<string | undefined>(undefined);
  const [compact, setCompact] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Runs before first paint so the entrance already knows which edge it comes
  // from, and whether the toast window is the stock 80px one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (mode !== "live" || !root) return;
    const e = edgeOf?.(root);
    if (e) setEdge(`${e.top ? "top" : "bottom"} ${e.left ? "left" : "right"}${e.inGame ? " ingame" : ""}`);
    const height = root.parentElement?.clientHeight ?? 0;
    if (height > 0 && height < 100) setCompact(true);
  }, [mode, edgeOf]);

  const tier = rarityTier(a.globalPct, s.rarityEffects);
  const css = useMemo(() => buildToastCSS(s, tier), [s, tier]);

  const progress = !a.achieved && a.progress && a.progress.max > a.progress.min ? a.progress : null;
  const fillPct = progress
    ? Math.min(100, Math.max(0, ((progress.current - progress.min) / (progress.max - progress.min)) * 100))
    : 0;

  const classes = ["ac-toast"];
  if (mode === "preview") classes.push("ac-preview");
  if (compact) classes.push("ac-compact");
  if (tier !== "none") classes.push(`ac-${tier}`);
  if (hasSkyBackground(s.decorativeElements)) classes.push("ac-sky-space");

  const pill = a.globalPct > 0 ? <span className={`ac-pill${tier === "none" ? " ac-pct" : ""}`}>{formatPct(a.globalPct)}</span> : null;

  return (
    <div ref={rootRef} className={classes.join(" ")} data-edge={edge} style={cssTokens(s)} onClick={onActivate}>
      <style>{css}</style>
      <div className={`ac-card${s.popupAnimation ? ` ac-in-${s.entranceStyle}` : ""}`}>
        <SkyLayer variant={s.decorativeElements} />
        <div className="ac-icon">
          {a.image && !imageFailed ? (
            <img src={a.image} alt="" onError={() => setImageFailed(true)} />
          ) : (
            <div className="ac-icon-fallback"><Badge /></div>
          )}
          <div className="ac-ring" />
        </div>
        <div className="ac-text">
          <div className="ac-eyebrow">
            <Badge />
            <span className="ac-eyebrow-label">{progress ? "Achievement progress" : UNLOCK_LABEL[tier]}</span>
            {pill}
          </div>
          <div className="ac-title">{a.name}</div>
          {progress ? (
            <div className="ac-progress">
              <div className="ac-bar"><div className="ac-fill" style={{ width: `${fillPct}%` }} /></div>
              <span className="ac-count">{formatCount(progress.current)} / {formatCount(progress.max)}</span>
            </div>
          ) : (
            <div className="ac-desc">{a.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
