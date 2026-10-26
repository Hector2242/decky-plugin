/**
 * @fileoverview Registry of toast decorations. Each decoration is a file
 * exporting a Theme; add its id to DECORATIONS (settings.ts) and register it
 * in THEMES.
 */

import type {JSX} from 'react';

import type {MotionParts} from '../motion';
import type {Decoration} from '../settings';
import {halloween} from './halloween';
import {hoth} from './hoth';
import {DITHER, PIXEL_BASE} from './pixel_art';
import {pixelDay} from './pixel_day';
import {pixelNight} from './pixel_night';
import {sakura} from './sakura';
import {skyDay, skyNight, sparkles} from './smooth';

/** A decoration: its sprites, their CSS and an optional scene background. */
export interface Theme {
  /** Only the theme's own sprites; DecorationLayer supplies the wrapper. */
  Layer: () => JSX.Element;
  css: () => MotionParts;
  /** Card background for themes that paint their own scene. */
  background?: string;
  /**
   * 16-bit scene. Both kinds get the shared sprite rules and band variables;
   * "banded" skies also get the dither strips between the four bands,
   * "custom" ones draw their own backdrop.
   */
  pixel?: 'banded' | 'custom';
}

const THEMES: Record<Decoration, Theme | null> = {
  'none': null,
  'sparkles': sparkles,
  'sky-day': skyDay,
  'sky-night': skyNight,
  'pixel-day': pixelDay,
  'pixel-night': pixelNight,
  'pixel-sakura': sakura,
  'pixel-halloween': halloween,
  'pixel-hoth': hoth,
};

/** Returns the card background of a decoration that paints its own scene. */
export function decorationBackground(decoration: Decoration): string | null {
  return THEMES[decoration]?.background ?? null;
}

/** Whether the decoration paints the whole card background. */
export function hasDecorationBackground(decoration: Decoration): boolean {
  return decorationBackground(decoration) !== null;
}

interface DecorationLayerProps {
  variant: Decoration;
}

/** Renders a decoration's sprites inside the shared `.ac-decoration` box. */
export function DecorationLayer({variant}: DecorationLayerProps) {
  const theme = THEMES[variant];
  if (!theme) return null;
  const {Layer, pixel} = theme;
  return (
    <div className={pixel ? 'ac-decoration ac-px-decoration' : 'ac-decoration'}>
      {pixel === 'banded' &&
        [1, 2, 3].map((i) => (
          <span key={i} className={`ac-px-dither ac-px-d${i}`} />
        ))}
      <Layer />
    </div>
  );
}

const NO_DECORATION: MotionParts = {always: '', full: '', reduced: ''};
// DecorationLayer wraps every theme in .ac-decoration, so this rule goes ahead
// of the theme's own CSS.
const DECORATION_BASE = `
  .ac-decoration {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: calc(var(--ac-radius) - 2px);
    pointer-events: none;
    z-index: 0;
  }`;

/** Returns the CSS of a decoration, shared base rules included. */
export function decorationCss(decoration: Decoration): MotionParts {
  const theme = THEMES[decoration];
  if (!theme) return NO_DECORATION;
  const parts = theme.css();
  const base = [DECORATION_BASE];
  if (theme.pixel) base.push(PIXEL_BASE);
  if (theme.pixel === 'banded') base.push(DITHER);
  return {...parts, always: `${base.join('\n')}\n${parts.always}`};
}
