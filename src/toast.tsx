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
import {type MotionParts, motionCss} from './motion';
import {
  type IconShape,
  type ThemeSettings,
  hexToRgbTriplet,
  sanitizeSettings,
} from './settings';

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
}

/** The screen edges the toast popup is anchored to. */
export interface ToastEdge {
  top: boolean;
  left: boolean;
  inGame: boolean;
}

type RarityTier = 'none' | 'uncommon' | 'rare' | 'ultra';

interface AchievementToastProps {
  achievement: ToastAchievement;
  settings: ThemeSettings;
  /**
   * "live" positions the card inside Steam's toast popup and plays the exit;
   * "preview" flows inline.
   */
  mode: 'live' | 'preview';
  /**
   * Resolves which screen edges the toast popup is anchored to, so entrances
   * come from the right side.
   */
  edgeOf?: (root: HTMLElement) => ToastEdge;
  onActivate?: () => void;
}

/** Corner radius of the achievement icon for each icon shape. */
export const ICON_RADIUS: Record<IconShape, string> = {
  circle: '50%',
  rounded: '8px',
  square: '0px',
};

function rarityTier(globalPercent: number, enabled: boolean): RarityTier {
  if (!enabled || !(globalPercent > 0)) return 'none';
  if (globalPercent < 1) return 'ultra';
  if (globalPercent < 10) return 'rare';
  if (globalPercent < 25) return 'uncommon';
  return 'none';
}

const UNLOCK_LABEL: Record<RarityTier, string> = {
  none: 'Achievement unlocked',
  uncommon: 'Uncommon unlock',
  rare: 'Rare achievement',
  ultra: 'Ultra rare unlock',
};

function formatPercent(percent: number): string {
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
}

function formatCount(count: number): string {
  return count.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(count) ? 0 : 1,
  });
}

const BADGE_PATH =
  'M30 30.05H26L24 34.05L20.11 27.57L22.9 24.8701L26.9 24.81L30 30.05ZM13.1 24.8701L9.1 24.81L6 30.05H10L12 34.05L15.89 27.57L13.1 24.8701ZM22.5 13.05C22.5 12.16 22.2361 11.29 21.7416 10.55C21.2471 9.80996 20.5443 9.23318 19.7221 8.89259C18.8998 8.552 17.995 8.46288 17.1221 8.63651C16.2492 8.81015 15.4474 9.23873 14.818 9.86807C14.1887 10.4974 13.7601 11.2992 13.5865 12.1721C13.4128 13.0451 13.5019 13.9499 13.8425 14.7721C14.1831 15.5944 14.7599 16.2972 15.4999 16.7917C16.24 17.2861 17.11 17.55 18 17.55C18.5913 17.5514 19.1771 17.4359 19.7236 17.2102C20.2702 16.9845 20.7668 16.6531 21.1849 16.235C21.603 15.8168 21.9345 15.3202 22.1601 14.7737C22.3858 14.2271 22.5013 13.6414 22.5 13.05ZM29 13.05L25.85 16.3L25.78 20.83L21.25 20.9L18 24.05L14.75 20.9L10.22 20.83L10.15 16.3L7 13.05L10.15 9.80005L10.22 5.27005L14.75 5.20005L18 2.05005L21.25 5.20005L25.78 5.27005L25.85 9.80005L29 13.05Z';

function Badge() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d={BADGE_PATH} />
    </svg>
  );
}

const PULSE: Record<RarityTier, string | null> = {
  none: null,
  uncommon: null,
  rare: 'ac-pulse-rare 2.5s ease-in-out 900ms infinite',
  ultra: 'ac-pulse-ultra 2s ease-in-out 900ms infinite',
};

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

function rarityCss(tier: RarityTier): MotionParts {
  if (tier === 'rare') {
    return {
      always: `
        .ac-rare .ac-card { border-color: #FFD700; }
        .ac-rare .ac-pill { background: rgb(255 215 0 / 0.18); color: #FFD700; }
        .ac-rare .ac-ring {
          opacity: 1;
          background: conic-gradient(from 0deg, transparent 0 55%, #FFD700 80%, transparent 100%);
        }
        @keyframes ac-pulse-rare {
          0%, 100% {
            box-shadow: 0 0 14px rgb(255 215 0 / 0.5), 0 0 30px rgb(255 165 0 / 0.2), 0 6px 18px rgb(0 0 0 / 0.35);
          }
          50% {
            box-shadow: 0 0 22px rgb(255 215 0 / 0.75), 0 0 48px rgb(255 165 0 / 0.4), 0 6px 18px rgb(0 0 0 / 0.35);
          }
        }`,
      full: '.ac-rare .ac-ring { animation: ac-spin 2.6s linear infinite; }',
      reduced: '',
    };
  }
  if (tier === 'ultra') {
    return {
      always: `
        .ac-ultra .ac-card { border-color: #E5E4E2; }
        .ac-ultra .ac-pill { background: rgb(229 228 226 / 0.22); color: #F4FAFF; }
        .ac-ultra .ac-ring {
          opacity: 1;
          background: conic-gradient(from 0deg, transparent 0 50%, #7FF6FF 72%, #E5E4E2 84%, transparent 100%);
        }
        @keyframes ac-pulse-ultra {
          0%, 100% {
            box-shadow: 0 0 14px rgb(229 228 226 / 0.55), 0 0 30px rgb(0 255 255 / 0.25), 0 6px 18px rgb(0 0 0 / 0.35);
          }
          50% {
            box-shadow: 0 0 24px rgb(0 255 255 / 0.65), 0 0 52px rgb(229 228 226 / 0.4), 0 6px 18px rgb(0 0 0 / 0.35);
          }
        }`,
      full: '.ac-ultra .ac-ring { animation: ac-spin 2.2s linear infinite; }',
      reduced: '',
    };
  }
  return {always: '', full: '', reduced: ''};
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
  const shine = shineCss(settings, tier === 'rare' || tier === 'ultra');
  const iconBorder = settings.iconBorder
    ? 'border: 2px solid var(--ac-accent); box-shadow: 0 0 8px rgb(var(--ac-accent-rgb) / 0.4);'
    : 'border: 0; box-shadow: none;';

  return {
    // round() keeps an odd-height card on whole pixels so pixel art stays
    // sharp; older clients drop it and keep -50%.
    always: `
      .ac-toast {
        --ac-dx: 1;
        position: absolute !important;
        left: -6px;
        right: 14px;
        top: 50%;
        translate: 0 -50%;
        translate: 0 round(-50%, 1px);
        margin: 0;
        font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .ac-toast[data-edge~="left"] { --ac-dx: -1; }
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
    motionCss(
      settings.popupAnimation ? settings.entranceStyle : null,
      PULSE[tier],
    ),
    rarityCss(tier),
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
  const [edge, setEdge] = useState<string | undefined>(undefined);
  const [compact, setCompact] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Runs before first paint so the entrance already knows which edge it comes
  // from, and whether the toast window is the stock 80px one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (mode !== 'live' || !root) return;
    const anchor = edgeOf?.(root);
    if (anchor) {
      const vertical = anchor.top ? 'top' : 'bottom';
      const horizontal = anchor.left ? 'left' : 'right';
      setEdge(`${vertical} ${horizontal}${anchor.inGame ? ' ingame' : ''}`);
    }
    const height = root.parentElement?.clientHeight ?? 0;
    if (height > 0 && height < 100) setCompact(true);
  }, [mode, edgeOf]);

  const tier = rarityTier(achievement.globalPercent, settings.rarityEffects);
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

  const classes = ['ac-toast'];
  if (mode === 'preview') classes.push('ac-preview');
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
          <div className="ac-ring" />
        </div>
        <div className="ac-text">
          <div className="ac-eyebrow">
            <Badge />
            <span className="ac-eyebrow-label">
              {shownProgress ? 'Achievement progress' : UNLOCK_LABEL[tier]}
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
