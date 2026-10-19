/**
 * @fileoverview The non-pixel decorations: Sparkles, Sky Day and Sky Night.
 */

import type {JSX} from 'react';

import type {MotionParts} from '../motion';
import type {Theme} from './index';

const SPARKLES = [
  {top: '18%', left: '16%', size: 10, delay: 0, duration: 2.4},
  {top: '64%', left: '12%', size: 7, delay: 0.9, duration: 2.8},
  {top: '34%', left: '27%', size: 6, delay: 1.7, duration: 2.2},
  {top: '78%', left: '33%', size: 9, delay: 0.45, duration: 3.0},
  {top: '12%', left: '43%', size: 8, delay: 1.3, duration: 2.6},
  {top: '70%', left: '51%', size: 6, delay: 2.1, duration: 2.4},
  {top: '26%', left: '58%', size: 12, delay: 0.7, duration: 3.2},
  {top: '80%', left: '66%', size: 7, delay: 1.55, duration: 2.5},
  {top: '20%', left: '74%', size: 9, delay: 2.35, duration: 2.9},
  {top: '58%', left: '80%', size: 8, delay: 1.05, duration: 2.7},
];

// size px, top %, left %, delay s, duration s
const STARS = [
  [2, 10, 5, 0, 2.5],
  [3, 24, 16, 0.3, 2.5],
  [2, 78, 9, 0.7, 2.5],
  [2, 55, 22, 1.2, 2.5],
  [4, 12, 31, 1.8, 2.5],
  [2, 83, 28, 0.5, 2.5],
  [2, 8, 42, 1.5, 2.5],
  [3, 85, 48, 0.9, 2.5],
  [2, 16, 54, 0.4, 1.8],
  [2, 74, 59, 1.1, 2.5],
  [2, 10, 65, 0.8, 3.5],
  [3, 81, 71, 1.6, 2.5],
  [2, 20, 77, 0.2, 2.5],
  [2, 68, 83, 1.9, 1.8],
  [3, 12, 89, 0.6, 3.5],
  [2, 86, 93, 1.3, 2.5],
];

const CONSTELLATION_PATH =
  'M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688Z';

const CONSTELLATIONS = [
  {top: '15%', left: '12%', width: 8, opacity: 0.7},
  {top: '62%', left: '36%', width: 6, opacity: 0.4},
  {top: '26%', left: '58%', width: 10, opacity: 0.8},
  {top: '67%', left: '80%', width: 7, opacity: 0.5},
];

function ConstellationHalf() {
  return (
    <div className="ac-drift-half">
      {CONSTELLATIONS.map((constellation, i) => (
        <svg
          key={i}
          className="ac-constellation"
          viewBox="133 0 8 9"
          style={{
            top: constellation.top,
            left: constellation.left,
            width: constellation.width,
            opacity: constellation.opacity,
          }}
        >
          <path d={CONSTELLATION_PATH} />
        </svg>
      ))}
    </div>
  );
}

// The sky follows the Primary/Secondary colors, so recoloring a preset
// recolors the scene.
const SMOOTH_SKY =
  'linear-gradient(160deg, var(--ac-primary) 0%, var(--ac-secondary) 100%)';

const DAY_TEXT = `
  .ac-title, .ac-desc {
    text-shadow: 0 1px 3px rgb(25 60 90 / 0.7), 0 0 6px rgb(25 60 90 / 0.35);
  }`;
const NIGHT_TEXT = `
  .ac-title, .ac-desc {
    text-shadow: 0 0 8px rgb(20 22 35 / 0.9), 0 1px 3px rgb(0 0 0 / 0.6);
  }`;
const DRIFT_KEYFRAMES =
  '@keyframes ac-drift-left { to { transform: translateX(-50%); } }';
const SMOOTH_BASE = `
  .ac-drift { position: absolute; inset: 0; overflow: hidden; }
  .ac-drift-track { display: flex; width: 200%; height: 100%; }
  .ac-drift-half { width: 50%; height: 100%; position: relative; }
  .ac-compact .ac-sun, .ac-compact .ac-moon { top: 18px; }
  @keyframes ac-glow { from { opacity: 0.35; } to { opacity: 1; } }`;

function SparklesLayer(): JSX.Element {
  return (
    <>
      {[...SPARKLES.keys()].map((i) => (
        <div key={i} className={`ac-sparkle ac-sparkle-${i + 1}`} />
      ))}
    </>
  );
}

// Per-element timing rules carry `.ac-decoration` so the animation shorthands
// in either motion branch cannot reset them.
function sparklesCss(): MotionParts {
  const placed = SPARKLES.map(
    (sparkle, i) => `
      .ac-decoration .ac-sparkle-${i + 1} {
        top: ${sparkle.top};
        left: ${sparkle.left};
        width: ${sparkle.size}px;
        height: ${sparkle.size}px;
        animation-delay: ${sparkle.delay}s;
        animation-duration: ${sparkle.duration}s;
      }`,
  );
  return {
    always: `${SMOOTH_BASE}
      .ac-sparkle {
        position: absolute;
        background: var(--ac-accent);
        clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);
        opacity: 0;
        box-shadow: 0 0 6px rgb(var(--ac-accent-rgb) / 0.67);
      }
      ${placed.join('\n')}`,
    full: `
      .ac-sparkle { animation: ac-sparkle 2.5s ease-in-out infinite; }
      @keyframes ac-sparkle {
        0%, 100% { opacity: 0; transform: scale(0.2) rotate(0deg); }
        35% { opacity: 1; transform: scale(1) rotate(25deg); }
        65% { opacity: 0.85; transform: scale(0.9) rotate(35deg); }
      }`,
    reduced:
      '.ac-sparkle { animation: ac-glow 2.5s ease-in-out infinite alternate; }',
  };
}

function SkyDayLayer(): JSX.Element {
  return (
    <>
      <div className="ac-sun" />
      <svg className="ac-birds" viewBox="0 0 60 20" width="40" height="20">
        <path
          d="M2 10 Q 7 2 12 10 Q 17 2 22 10"
          fill="none"
          stroke="#FFF8E7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M25 15 Q 30 7 35 15 Q 40 7 45 15"
          fill="none"
          stroke="#FFF8E7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="ac-drift">
        <div className="ac-drift-track ac-drift-back">
          <div className="ac-drift-half">
            <div className="ac-cloud-3" />
          </div>
          <div className="ac-drift-half">
            <div className="ac-cloud-3" />
          </div>
        </div>
      </div>
      <div className="ac-drift">
        <div className="ac-drift-track ac-drift-front">
          <div className="ac-drift-half">
            <div className="ac-cloud-1" />
            <div className="ac-cloud-2" />
          </div>
          <div className="ac-drift-half">
            <div className="ac-cloud-1" />
            <div className="ac-cloud-2" />
          </div>
        </div>
      </div>
    </>
  );
}

function skyDayCss(): MotionParts {
  const sunGlow =
    'inset 1px 1px 2px rgb(254 255 239 / 0.6), inset 0 -1px 2px rgb(161 135 42 / 0.5)';
  return {
    always: `${SMOOTH_BASE}
      .ac-sun {
        position: absolute;
        top: 26px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #ECCA2F;
        box-shadow: ${sunGlow}, 0 0 12px rgb(236 202 47 / 0.35);
        animation: ac-sun 4s ease-in-out infinite;
      }
      @keyframes ac-sun {
        50% { box-shadow: ${sunGlow}, 0 0 18px rgb(236 202 47 / 0.7); }
      }
      .ac-birds { position: absolute; top: 22%; left: 40%; opacity: 0.5; }
      .ac-cloud-1, .ac-cloud-2, .ac-cloud-3 {
        position: absolute;
        border-radius: 50%;
      }
      .ac-cloud-1 {
        width: 26px;
        height: 26px;
        background: #F3FDFF;
        top: 82%;
        left: 4%;
        box-shadow: 20px -6px 0 7px #F3FDFF, 44px 3px 0 -3px #F3FDFF, -15px 5px 0 -5px #F3FDFF;
      }
      .ac-cloud-2 {
        width: 32px;
        height: 32px;
        background: #F3FDFF;
        top: 80%;
        left: 55%;
        box-shadow: 24px 7px 0 -3px #F3FDFF, 48px -5px 0 5px #F3FDFF, -21px 9px 0 -7px #F3FDFF, 69px 9px 0 -6px #F3FDFF;
      }
      .ac-cloud-3 {
        width: 28px;
        height: 28px;
        background: #AACADF;
        top: 74%;
        left: 28%;
        box-shadow: 27px -5px 0 4px #AACADF, 57px 7px 0 -3px #AACADF, -24px 7px 0 -6px #AACADF, 81px -3px 0 5px #AACADF, 111px 6px 0 -5px #AACADF;
      }
      .ac-drift-back { opacity: 0.7; }
      .ac-drift-front { opacity: 0.9; }
      ${DAY_TEXT}`,
    full: `
      .ac-drift-back { animation: ac-drift-left 30s linear infinite; }
      .ac-drift-front { animation: ac-drift-left 20s linear infinite; }
      ${DRIFT_KEYFRAMES}`,
    reduced: '',
  };
}

function SkyNightLayer(): JSX.Element {
  return (
    <>
      <div className="ac-moon" />
      {[...STARS.keys()].map((i) => (
        <div key={i} className={`ac-star ac-star-${i + 1}`} />
      ))}
      <div className="ac-drift">
        <div className="ac-drift-track ac-drift-stars">
          <ConstellationHalf />
          <ConstellationHalf />
        </div>
      </div>
    </>
  );
}

function skyNightCss(): MotionParts {
  const stars = STARS.map(
    ([size, top, left, delay, duration], i) => `
      .ac-decoration .ac-star-${i + 1} {
        width: ${size}px;
        height: ${size}px;
        top: ${top}%;
        left: ${left}%;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
      }`,
  );
  const crescent =
    'radial-gradient(circle at 76% 41%, transparent 44%, #000 45%)';
  return {
    always: `${SMOOTH_BASE}
      .ac-moon {
        position: absolute;
        top: 26px;
        right: 11px;
        width: 26px;
        height: 26px;
        animation: ac-moon 5s ease-in-out infinite;
      }
      .ac-moon::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: #C4C9D1;
        box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.5);
        -webkit-mask: ${crescent};
        mask: ${crescent};
      }
      @keyframes ac-moon {
        50% { filter: drop-shadow(0 0 5px rgb(255 255 255 / 0.45)); }
      }
      .ac-star {
        position: absolute;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 4px rgb(255 255 255 / 0.85);
      }
      ${stars.join('\n')}
      .ac-constellation { position: absolute; fill: #fff; }
      ${NIGHT_TEXT}`,
    full: `
      .ac-star { animation: ac-twinkle 2.5s ease-in-out infinite alternate; }
      @keyframes ac-twinkle {
        from { opacity: 0.25; transform: scale(0.7); }
        to   { opacity: 1; transform: scale(1.25); }
      }
      .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }
      ${DRIFT_KEYFRAMES}`,
    reduced:
      '.ac-star { animation: ac-glow 2.5s ease-in-out infinite alternate; }',
  };
}

/** Accent-colored sparkles that twinkle over the card. */
export const sparkles: Theme = {Layer: SparklesLayer, css: sparklesCss};
/** A daytime sky with sun, birds and drifting clouds. */
export const skyDay: Theme = {
  Layer: SkyDayLayer,
  css: skyDayCss,
  background: SMOOTH_SKY,
};
/** A night sky with a crescent moon, stars and drifting constellations. */
export const skyNight: Theme = {
  Layer: SkyNightLayer,
  css: skyNightCss,
  background: SMOOTH_SKY,
};
