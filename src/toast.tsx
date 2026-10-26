/**
 * @fileoverview The achievement toast: one component and one CSS builder for
 * live, test and preview toasts.
 */

import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DecorationLayer,
  decorationBackground,
  decorationCss,
  hasDecorationBackground,
} from './decorations';
import {type MotionParts, motionCss, revealCss} from './motion';
import {
  type IconShape,
  type ThemeSettings,
  hexToRgbTriplet,
  isLightColor,
  sanitizeSettings,
} from './settings';
import {TrophyIcon} from './trophy_icon';

/** What a toast shows, read from Steam's notification or a sample. */
export interface ToastAchievement {
  appId: number;
  id: string;
  name: string;
  description: string;
  image: string;
  achieved: boolean;
  /** Global unlock percentage, 0-100. Zero or negative means unknown. */
  globalPercent: number;
  progress?: {min: number; current: number; max: number};
  /** This unlock was the game's last locked achievement. */
  completesGame?: boolean;
}

/** How Steam laid out the toast window around the chosen position. */
export interface ToastEdge {
  /** In game the window reaches past the screen edge. */
  inGame: boolean;
  /** Steam's left-side popup (left: 0; right: 20px) instead of the right one. */
  mirrored: boolean;
}

type RarityTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

interface AchievementToastProps {
  achievement: ToastAchievement;
  settings: ThemeSettings;
  /**
   * "live" positions the card inside Steam's toast popup and plays the exit;
   * "preview" flows inline.
   */
  mode: 'live' | 'preview';
  /**
   * Reads how Steam laid out the toast window, or null when its classes are
   * unknown and the chosen position could not be applied. Live toasts only.
   */
  edgeOf?: (root: HTMLElement) => ToastEdge | null;
  onActivate?: () => void;
}

/** Corner radius of the achievement icon for each icon shape. */
export const ICON_RADIUS: Record<IconShape, string> = {
  circle: '50%',
  rounded: '8px',
  square: '0px',
};

// PlayStation-like cutoffs on the share of players who have it.
// Platinum is only for the unlock that completes the game (100%).
function rarityTier(
  achievement: ToastAchievement,
  enabled: boolean,
): RarityTier {
  const {globalPercent} = achievement;
  if (!enabled) return 'none';
  if (achievement.achieved && achievement.completesGame) return 'platinum';
  if (!(globalPercent > 0)) return 'none';
  if (globalPercent < 15) return 'gold';
  if (globalPercent < 50) return 'silver';
  return 'bronze';
}

const UNLOCK_LABEL: Record<RarityTier, string> = {
  none: 'Achievement unlocked',
  bronze: 'Bronze trophy',
  silver: 'Silver trophy',
  gold: 'Gold trophy',
  platinum: 'Platinum trophy',
};

// Light, base and dark tone of each tier's metal.
const TIER_SHADES: Record<
  Exclude<RarityTier, 'none'>,
  [string, string, string]
> = {
  bronze: ['#f2b47a', '#cd7f32', '#7a4519'],
  silver: ['#ffffff', '#c0c0c0', '#6f7680'],
  gold: ['#fff4b0', '#ffd700', '#a87b00'],
  platinum: ['#ffffff', '#e5e4e2', '#7c8ea6'],
};

function formatPercent(percent: number): string {
  if (percent < 0.1) return '<0.1%';
  // Rounded down so the shown number never crosses its tier's limit; the
  // epsilon absorbs float noise such as 2.2999999.
  return percent < 10
    ? `${(Math.floor(percent * 10 + 1e-6) / 10).toFixed(1)}%`
    : `${Math.floor(percent + 1e-6)}%`;
}

function formatCount(count: number): string {
  return count.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(count) ? 0 : 1,
  });
}

// Steam's achievement trophy: an eight-point badge with a round hole, its
// ribbon tails and a base.
const BADGE_PATH =
  'M21.5 6L26 10.5H32.5V17L37 21.5L32.5 26V32.5H26L21.5 37L17 32.5H10.5V26L6 21.5L10.5 17V10.5H17ZM28.5 21.5A7 7 0 1 0 14.5 21.5A7 7 0 1 0 28.5 21.5ZM12 38H16L19.5 48H15.5ZM27 38H31L27.5 48H23.5ZM12 51H31L33 54H10Z';

function Badge() {
  return (
    <svg viewBox="6 6 31 48" aria-hidden="true">
      <path d={BADGE_PATH} fillRule="evenodd" />
    </svg>
  );
}

// Gold and platinum pulse a brighter glow over the card's own (from 900 ms):
// fading a layer runs on the GPU, while animating box-shadow repaints the card
// every frame.
const PULSE_LAYER = `
  content: "";
  position: absolute;
  inset: -2px;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;`;

function backgroundCss(settings: ThemeSettings): string {
  const scene = decorationBackground(settings.decorativeElements);
  if (scene) return `background: ${scene};`;
  if (settings.bannerStyle === 'solid') return 'background: var(--ac-primary);';
  if (settings.bannerStyle === 'glass') {
    return `
      background: rgb(var(--ac-primary-rgb) / 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);`;
  }
  return 'background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));';
}

function rarityCss(tier: RarityTier, lightCard: boolean): MotionParts {
  if (tier === 'none') return {always: '', full: '', reduced: ''};
  const [light, color, dark] = TIER_SHADES[tier];
  // The trophy covers the icon at rest; motion.ts reveals it.
  const shared = `
    .ac-toast {
      --ac-tier: ${color};
      --ac-tier-rgb: ${hexToRgbTriplet(color)};
      --ac-tier-light: ${light};
      --ac-tier-dark: ${dark};
    }
    .ac-toast .ac-pill { background: rgb(var(--ac-tier-rgb) / 0.18); }
    .ac-toast .ac-pill, .ac-toast .ac-eyebrow {
      color: var(${lightCard ? '--ac-tier-dark' : '--ac-tier'});
    }
    .ac-toast .ac-icon img, .ac-toast .ac-icon-fallback { border-color: var(--ac-tier); }
    .ac-trophy {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border: 2px solid var(--ac-tier);
      border-radius: inherit;
      background: #15161a;
      background: radial-gradient(
        circle at 50% 15%,
        color-mix(in srgb, var(--ac-tier) 55%, #000),
        color-mix(in srgb, var(--ac-tier) 26%, #000) 55%,
        color-mix(in srgb, var(--ac-tier) 10%, #000)
      );
    }
    .ac-trophy svg { width: 70%; height: 70%; overflow: visible; }
    .ac-t-base { fill: var(--ac-tier); }
    .ac-t-light { fill: var(--ac-tier-light); }
    .ac-t-dark { fill: var(--ac-tier-dark); }
    .ac-t-shade { fill: var(--ac-tier-dark); opacity: 0.35; }
    .ac-t-handle, .ac-t-shine { fill: none; stroke-linecap: round; }
    .ac-t-handle { stroke: var(--ac-tier-dark); stroke-width: 4.5; }
    .ac-t-shine { stroke: var(--ac-tier-light); stroke-width: 2.4; opacity: 0.85; }
    .ac-t-star { stroke: var(--ac-tier-dark); stroke-width: 0.8; }
    /* Each sparkle is its own layer over the cup, scaled about its centre. */
    .ac-glint {
      position: absolute;
      width: 70%;
      height: 70%;
      fill: #fff;
      transform-origin: 79.7% 10.9%;
    }
    .ac-trophy .ac-glint svg { width: 100%; height: 100%; }
    .ac-glint-2 { transform-origin: 14.1% 31.3%; }
    .ac-glint-3 { transform-origin: 85.9% 68.8%; }
    .ac-glint-more { display: none; }`;
  const glint = `
    .ac-glint { animation: ac-glint 2.4s ease-in-out infinite; }
    @keyframes ac-glint {
      0%, 100% { opacity: 0.35; scale: 0.5; }
      50% { opacity: 1; scale: 1; }
    }`;
  if (tier === 'gold') {
    return {
      always: `${shared}
        .ac-gold .ac-ring {
          opacity: 1;
          --ac-ring-light: conic-gradient(from 0deg, transparent 0 55%, #FFD700 80%, transparent 100%);
        }
        .ac-gold .ac-card {
          box-shadow: 0 0 14px rgb(255 215 0 / 0.5), 0 0 30px rgb(255 165 0 / 0.2), 0 6px 18px rgb(0 0 0 / 0.35);
        }
        .ac-gold .ac-card::before {
          ${PULSE_LAYER}
          box-shadow: 0 0 22px rgb(255 215 0 / 0.75), 0 0 48px rgb(255 165 0 / 0.4);
          animation: ac-pulse 2.5s ease-in-out 900ms infinite;
        }
        @keyframes ac-pulse { 50% { opacity: 1; } }`,
      full: `${glint} .ac-gold .ac-ring::before { animation: ac-spin 2.6s linear infinite; }`,
      reduced: '',
    };
  }
  if (tier === 'platinum') {
    return {
      always: `${shared}
        .ac-platinum .ac-card { border-color: ${lightCard ? 'var(--ac-tier-dark)' : '#E5E4E2'}; }
        /* Steam's own platinum flourish: a shine sweeping across, more sparkles. */
        .ac-platinum .ac-trophy { overflow: hidden; }
        .ac-platinum .ac-trophy::after {
          content: "";
          position: absolute;
          inset: 0;
          translate: -120% 0;
          background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.6) 46%, rgb(255 255 255 / 0.15) 54%, transparent 70%);
        }
        .ac-platinum .ac-glint-more { display: inline; }
        .ac-platinum .ac-ring {
          opacity: 1;
          --ac-ring-light: conic-gradient(from 0deg, transparent 0 50%, #7FF6FF 72%, #E5E4E2 84%, transparent 100%);
        }
        .ac-platinum .ac-card {
          box-shadow: 0 0 14px rgb(229 228 226 / 0.55), 0 0 30px rgb(0 255 255 / 0.25), 0 6px 18px rgb(0 0 0 / 0.35);
        }
        .ac-platinum .ac-card::before {
          ${PULSE_LAYER}
          box-shadow: 0 0 24px rgb(0 255 255 / 0.65), 0 0 52px rgb(229 228 226 / 0.4);
          animation: ac-pulse 2s ease-in-out 900ms infinite;
        }
        @keyframes ac-pulse { 50% { opacity: 1; } }`,
      full: `${glint}
        .ac-platinum .ac-ring::before { animation: ac-spin 2.2s linear infinite; }
        .ac-platinum .ac-trophy::after { animation: ac-plat-shine 3s ease-in-out infinite; }
        .ac-glint-2 { animation-delay: -0.8s; }
        .ac-glint-3 { animation-delay: -1.6s; }
        @keyframes ac-plat-shine {
          0% { translate: -120% 0; }
          35%, 100% { translate: 120% 0; }
        }`,
      reduced: '',
    };
  }
  return {always: shared, full: glint, reduced: ''};
}

function shineCss(settings: ThemeSettings, intense: boolean): MotionParts {
  if (!settings.shineEnabled) return {always: '', full: '', reduced: ''};
  return {
    always: `
      .ac-card::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 2;
        border-radius: inherit;
        pointer-events: none;
        opacity: 0;
        background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / ${intense ? 0.5 : 0.28}) 50%, transparent 65%);
        background-size: 300% 100%;
        background-repeat: no-repeat;
      }`,
    full: `
      .ac-card::after {
        animation: ac-shine ${intense ? '1100ms' : '900ms'} ease-in-out 300ms ${intense ? 2 : 1} both;
      }
      @keyframes ac-shine {
        0%   { background-position: 150% 0; opacity: 0; }
        15%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { background-position: -150% 0; opacity: 0; }
      }`,
    reduced: '',
  };
}

function baseCss(settings: ThemeSettings, tier: RarityTier): MotionParts {
  const glowPx = Math.min(24, Math.max(4, settings.glowIntensity));
  const glowAlpha = (0.3 + settings.glowIntensity / 100).toFixed(2);
  const shadow = settings.glowEnabled
    ? `0 0 ${glowPx}px rgb(var(--ac-accent-rgb) / ${glowAlpha}), 0 0 ${glowPx * 2}px rgb(var(--ac-accent-rgb) / 0.25), 0 6px 18px rgb(0 0 0 / 0.35)`
    : '0 6px 18px rgb(0 0 0 / 0.35)';
  const shine = shineCss(settings, tier === 'gold' || tier === 'platinum');
  const iconBorder = settings.iconBorder
    ? 'border: 2px solid var(--ac-accent); box-shadow: 0 0 8px rgb(var(--ac-accent-rgb) / 0.4);'
    : 'border: 0; box-shadow: none;';

  return {
    // round() to 2px keeps an odd-height card on whole device pixels at 1x and
    // at Steam's 1.5x UI scale, so pixel art stays sharp; older clients drop it
    // and keep -50%.
    always: `
      .ac-toast {
        position: absolute !important;
        left: -6px;
        right: 14px;
        top: 50%;
        translate: 0 -50%;
        translate: 0 round(-50%, 2px);
        margin: 0;
        font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      /* Steam mirrors the popup on the left (left: 0; right: 20px). */
      .ac-toast[data-edge~="mirrored"] { left: 14px; right: -6px; }
      .ac-toast[data-edge~="ingame"] { top: auto; bottom: 58px; translate: none; }
      .ac-toast[data-edge~="ingame"][data-edge~="top"] { top: 38px; bottom: auto; }
      .ac-toast.ac-preview {
        position: relative !important;
        left: auto;
        right: auto;
        top: auto;
        translate: none;
        width: 100%;
        animation: none !important;
      }

      .ac-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 64px;
        padding: 10px 12px;
        box-sizing: border-box;
        border: 2px solid var(--ac-accent);
        border-radius: var(--ac-radius);
        ${backgroundCss(settings)}
        box-shadow: ${shadow};
        color: var(--ac-text);
        isolation: isolate;
      }
      .ac-compact .ac-card { min-height: 0; padding: 6px 10px; gap: 10px; }

      .ac-icon {
        position: relative;
        z-index: 1;
        flex: 0 0 48px;
        width: 48px;
        height: 48px;
        border-radius: var(--ac-icon-radius);
      }
      .ac-compact .ac-icon { flex-basis: 40px; width: 40px; height: 40px; }
      .ac-face { height: 100%; border-radius: inherit; }
      .ac-icon img, .ac-icon-fallback {
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-radius: inherit;
        object-fit: cover;
        background: rgb(0 0 0 / 0.3);
        ${iconBorder}
      }
      .ac-icon-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ac-accent);
      }
      .ac-icon-fallback svg { width: 60%; height: 60%; fill: currentColor; }
      .ac-ring {
        position: absolute;
        inset: -4px;
        border-radius: calc(var(--ac-icon-radius) + 4px);
        padding: 2px;
        opacity: 0;
        pointer-events: none;
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        mask-composite: exclude;
      }
      /* The light turns inside the still ring, so square and rounded icons get
         it traced side by side rather than a spinning frame. */
      .ac-ring::before {
        content: "";
        position: absolute;
        inset: -25%;
        background: var(--ac-ring-light, none);
      }

      .ac-text {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ac-decoration-space .ac-title,
      .ac-decoration-space .ac-desc,
      .ac-decoration-space .ac-progress { padding-right: 34px; }
      .ac-eyebrow {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font-size: 10px;
        line-height: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ac-accent);
      }
      .ac-eyebrow svg {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
      .ac-eyebrow-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ac-pill {
        margin-left: auto;
        flex: 0 0 auto;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 9px;
        line-height: 12px;
        letter-spacing: 0.06em;
        white-space: nowrap;
        background: rgb(var(--ac-accent-rgb) / 0.18);
        color: var(--ac-accent);
      }
      .ac-pill.ac-pct {
        padding: 0;
        background: none;
        color: var(--ac-desc);
        opacity: 0.85;
      }
      .ac-title {
        font-size: 14px;
        line-height: 17px;
        font-weight: 600;
        color: var(--ac-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ac-desc {
        font-size: 11px;
        line-height: 14px;
        color: var(--ac-desc);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ac-compact .ac-desc { -webkit-line-clamp: 1; }
      .ac-progress {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        line-height: 14px;
        color: var(--ac-desc);
      }
      .ac-bar {
        flex: 1 1 auto;
        height: 6px;
        border-radius: 3px;
        background: rgb(var(--ac-accent-rgb) / 0.22);
        overflow: hidden;
      }
      .ac-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--ac-accent);
        transform-origin: left;
      }
      .ac-count { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
      ${shine.always}`,
    full: `
      .ac-fill {
        animation: ac-fill 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 350ms both;
      }
      @keyframes ac-fill { from { transform: scaleX(0); } }
      @keyframes ac-spin { to { transform: rotate(1turn); } }
      ${shine.full}`,
    reduced: '',
  };
}

/**
 * Builds the complete stylesheet of a toast. Exported so the CSS can be
 * checked off-device; pass sanitized settings.
 */
export function buildToastCss(
  settings: ThemeSettings,
  tier: RarityTier,
): string {
  const parts: MotionParts[] = [
    baseCss(settings, tier),
    motionCss(settings.popupAnimation ? settings.entranceStyle : null),
    // Pale tiers turn to their dark tone on light cards to stay readable.
    rarityCss(tier, isLightColor(settings.primaryColor)),
    revealCss(
      tier === 'none' ? 'off' : settings.trophyReveal,
      settings.duration,
    ),
    decorationCss(settings.decorativeElements),
  ];
  const join = (key: keyof MotionParts): string =>
    parts.map((part) => part[key]).join('\n');
  if (settings.ignoreReducedMotion) {
    return `${join('always')}\n${join('full')}`;
  }
  // Steam's Reduce Motion setting reaches the toast window as
  // prefers-reduced-motion.
  return `${join('always')}
    @media (prefers-reduced-motion: no-preference) {${join('full')}}
    @media (prefers-reduced-motion: reduce) {${join('reduced')}}`;
}

function cssTokens(settings: ThemeSettings): CSSProperties {
  const tokens: Record<string, string> = {
    '--ac-primary': settings.primaryColor,
    '--ac-primary-rgb': hexToRgbTriplet(settings.primaryColor),
    '--ac-secondary': settings.secondaryColor,
    '--ac-accent': settings.accentColor,
    '--ac-accent-rgb': hexToRgbTriplet(settings.accentColor),
    '--ac-text': settings.textColor,
    '--ac-desc': settings.descColor,
    '--ac-radius': `${settings.borderRadius}px`,
    '--ac-icon-radius': ICON_RADIUS[settings.iconShape],
  };
  // CSSProperties has no index signature for custom properties.
  return tokens as CSSProperties;
}

/** Renders one achievement toast with the given theme. */
export function AchievementToast({
  achievement,
  settings: rawSettings,
  mode,
  edgeOf,
  onActivate,
}: AchievementToastProps) {
  const settings = useMemo(() => sanitizeSettings(rawSettings), [rawSettings]);
  const rootRef = useRef<HTMLDivElement>(null);
  // Null when Steam's toast window is stock and the position was not applied.
  const [windowFlags, setWindowFlags] = useState<string | null>('');
  const [compact, setCompact] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Runs before first paint so the card already sits right in Steam's window,
  // and knows whether that window is the stock 80px one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (mode !== 'live' || !root) return;
    const layout = edgeOf?.(root);
    if (layout === null) {
      setWindowFlags(null);
    } else if (layout) {
      setWindowFlags(
        `${layout.inGame ? ' ingame' : ''}${layout.mirrored ? ' mirrored' : ''}`,
      );
    }
    // Steam's toast window is 1x1 or 2x2 until first shown; a real one is at
    // least 80px tall.
    const minWindowHeight = 40;
    const measure = () => {
      const height = root.parentElement?.clientHeight ?? 0;
      setCompact(height >= minWindowHeight && height < 100);
    };
    measure();
    // The first toast after Steam starts can land in a window that is still
    // unsized and has never painted: its animation clock reads 0 and then jumps
    // to real time, so the exit would already be over. Start again once sized.
    const view = root.ownerDocument.defaultView;
    if (!view) return;
    let restart = view.innerHeight < minWindowHeight;
    const onResize = () => {
      if (view.innerHeight < minWindowHeight) return;
      measure();
      if (!restart) return;
      restart = false;
      for (const animation of root.getAnimations({subtree: true})) {
        animation.cancel();
        animation.play();
      }
    };
    view.addEventListener('resize', onResize);
    return () => {
      view.removeEventListener('resize', onResize);
    };
  }, [mode, edgeOf]);

  const tier = rarityTier(achievement, settings.rarityEffects);
  const css = useMemo(() => buildToastCss(settings, tier), [settings, tier]);

  const {progress} = achievement;
  const shownProgress =
    !achievement.achieved && progress && progress.max > progress.min
      ? progress
      : null;
  const fillPercent = shownProgress
    ? Math.min(
        100,
        Math.max(
          0,
          ((shownProgress.current - shownProgress.min) /
            (shownProgress.max - shownProgress.min)) *
            100,
        ),
      )
    : 0;

  // Only an unlock earns its trophy.
  const revealing =
    tier !== 'none' && settings.trophyReveal !== 'off' && achievement.achieved;
  // A stock window sits where Steam put it: bottom right unless a game moved it.
  const edge =
    windowFlags === null
      ? 'bottom right'
      : `${settings.position.replace('-', ' ')}${windowFlags}`;

  const classes = ['ac-toast'];
  if (mode === 'preview') classes.push('ac-preview');
  if (revealing) classes.push('ac-reveal');
  if (compact) classes.push('ac-compact');
  if (tier !== 'none') classes.push(`ac-${tier}`);
  if (hasDecorationBackground(settings.decorativeElements)) {
    classes.push('ac-decoration-space');
  }
  const cardClass = settings.popupAnimation
    ? `ac-card ac-in-${settings.entranceStyle}`
    : 'ac-card';
  const pill =
    achievement.globalPercent > 0 ? (
      <span className={tier === 'none' ? 'ac-pill ac-pct' : 'ac-pill'}>
        {formatPercent(achievement.globalPercent)}
      </span>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={classes.join(' ')}
      data-edge={edge}
      style={cssTokens(settings)}
      onClick={onActivate}
    >
      <style>{css}</style>
      <div className={cardClass}>
        <DecorationLayer variant={settings.decorativeElements} />
        <div className="ac-icon">
          {/* Reveals animate this wrapper, so a late image failure that swaps
              in the badge does not restart them. */}
          <div className="ac-face">
            {achievement.image && !imageFailed ? (
              <img
                src={achievement.image}
                alt=""
                onError={() => {
                  setImageFailed(true);
                }}
              />
            ) : (
              <div className="ac-icon-fallback">
                <Badge />
              </div>
            )}
          </div>
          {revealing ? (
            <>
              <div className="ac-trophy">
                <TrophyIcon />
              </div>
              {/* Reveal sprites; Blood and Laser Blast use all eight. */}
              <span className="ac-reveal-fx">
                {[...Array(8).keys()].map((n) => (
                  <i key={n} />
                ))}
              </span>
            </>
          ) : null}
          <div className="ac-ring" />
        </div>
        <div className="ac-text">
          <div className="ac-eyebrow">
            <Badge />
            <span className="ac-eyebrow-label">
              {achievement.achieved
                ? UNLOCK_LABEL[tier]
                : 'Achievement progress'}
            </span>
            {pill}
          </div>
          <div className="ac-title">{achievement.name}</div>
          {shownProgress ? (
            <div className="ac-progress">
              <div className="ac-bar">
                <div className="ac-fill" style={{width: `${fillPercent}%`}} />
              </div>
              <span className="ac-count">
                {formatCount(shownProgress.current)} /{' '}
                {formatCount(shownProgress.max)}
              </span>
            </div>
          ) : (
            <div className="ac-desc">{achievement.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
