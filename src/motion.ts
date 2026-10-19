/**
 * @fileoverview Entrance and exit animations. Springs use Motion's maths,
 * precomputed into CSS `linear()` easings.
 */

import type {EntranceStyle} from './settings';

/**
 * CSS split by motion policy: `always` applies in every mode, `full` only when
 * animations are allowed, `reduced` only when Steam's Reduce Motion is on and
 * "Animate anyway" is off.
 */
export interface MotionParts {
  always: string;
  full: string;
  reduced: string;
}

interface EntranceMotion {
  /** Animations on .ac-card; the rarity pulse is appended after them. */
  card: string[];
  /** Keyframes and child rules for the entrance (live and preview). */
  enter: string;
  /** The root exit; it starts at --toast-duration and must stay within 460 ms. */
  exit: string;
  /** Extra root declarations the exit needs. */
  exitRoot?: string;
  /** Keyframes and child rules for the exit (live toasts only). */
  exitRules: string;
}

/** Motion's duration-based spring options. */
interface SpringOptions {
  /** Seconds until the spring visually arrives. */
  visualDuration: number;
  /** 0 never overshoots; higher values bounce more. */
  bounce: number;
}

interface SpringTiming {
  easing: string;
  durationMs: number;
}

const SPRING_SAMPLES = 48;

// Motion's duration-based spring (mass 1): visualDuration and bounce give
// stiffness and damping; the closed-form oscillator is sampled into linear()
// until its envelope settles.
function springEasing({visualDuration, bounce}: SpringOptions): SpringTiming {
  const omega = (2 * Math.PI) / (visualDuration * 1.2);
  const dampingRatio = Math.min(1, Math.max(0.05, 1 - bounce));
  const dampedOmega = omega * Math.sqrt(1 - dampingRatio * dampingRatio);
  const decay = dampingRatio * omega;
  const position = (t: number): number =>
    dampingRatio < 1
      ? 1 -
        Math.exp(-decay * t) *
          (Math.cos(dampedOmega * t) +
            (decay / dampedOmega) * Math.sin(dampedOmega * t))
      : 1 - Math.exp(-omega * t) * (1 + omega * t);
  const envelope = (t: number): number =>
    dampingRatio < 1
      ? Math.exp(-decay * t) * Math.hypot(1, decay / dampedOmega)
      : Math.exp(-omega * t) * (1 + omega * t);
  let settleTime = 0.05;
  while (envelope(settleTime) > 0.002 && settleTime < 4) {
    settleTime += 0.01;
  }
  const points: string[] = [];
  for (let i = 0; i < SPRING_SAMPLES; i++) {
    const t = (settleTime * i) / SPRING_SAMPLES;
    points.push(String(Number(position(t).toFixed(3))));
  }
  points.push('1');
  return {
    easing: `linear(${points.join(', ')})`,
    durationMs: Math.round(settleTime * 1000),
  };
}

const SUPPORTS_LINEAR_EASING =
  typeof CSS === 'undefined' ||
  CSS.supports('animation-timing-function', 'linear(0, 1)');

// Older Steam clients lack linear(): fall back to an ease-out of similar
// length. It never overshoots, so Slide cannot run past the window edge.
function spring(options: SpringOptions): SpringTiming {
  if (SUPPORTS_LINEAR_EASING) return springEasing(options);
  return {
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    durationMs: Math.round(options.visualDuration * 1300),
  };
}

const SPRING = {
  slide: spring({visualDuration: 0.45, bounce: 0.12}),
  drop: spring({visualDuration: 0.5, bounce: 0.22}),
  pop: spring({visualDuration: 0.35, bounce: 0.5}),
  flip: spring({visualDuration: 0.5, bounce: 0.3}),
};

const LIVE_TOAST = '.ac-toast:not(.ac-preview)';
const AT_EXIT = 'var(--toast-duration, 6000ms)';
const ACCELERATE = 'cubic-bezier(0.4, 0, 1, 1)';
const ACCELERATE_HARD = 'cubic-bezier(0.55, 0, 1, 0.45)';
const DECELERATE = 'cubic-bezier(0, 0.55, 0.45, 1)';
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
// Unfold's disc around the icon; --ac-disc-x/--ac-disc-r follow the compact
// layout.
const DISC_CLIP =
  'inset(calc(50% - var(--ac-disc-r)) calc(100% - var(--ac-disc-x) - var(--ac-disc-r)) calc(50% - var(--ac-disc-r)) calc(var(--ac-disc-x) - var(--ac-disc-r)) round var(--ac-disc-r))';
// Negative insets keep the glow inside the clip.
const OPEN_CLIP = 'inset(-48px round var(--ac-radius))';
const TEXT_IN = 'ac-text-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) 520ms both';
const RETRO_SHOW = 'ac-retro-show 420ms steps(1, end) both';

// Vertical travel (--ac-fall) stays inside the toast window: a centred card
// has ~21px above it, a compact or bottom-anchored in-game one ~8px.
const ENTRANCES: Record<EntranceStyle, EntranceMotion> = {
  // Xbox: the icon disc pops in, holds, then the card unfolds out of it; the
  // exit folds it back.
  unfold: {
    card: ['ac-in-unfold 1000ms cubic-bezier(0.25, 0.8, 0.3, 1) both'],
    enter: `
      .ac-in-unfold { transform-origin: var(--ac-disc-x) 50%; }
      .ac-in-unfold .ac-text { animation: ${TEXT_IN}; }
      @keyframes ac-in-unfold {
        0% {
          opacity: 0;
          transform: scale(0.4);
          clip-path: ${DISC_CLIP};
        }
        18%  { opacity: 1; transform: scale(1.08); }
        28%  { transform: none; }
        48%  { clip-path: ${DISC_CLIP}; }
        100% { clip-path: ${OPEN_CLIP}; }
      }
      @keyframes ac-text-in {
        from { opacity: 0; transform: translateX(-10px); }
      }`,
    exit: 'ac-out-unfold 460ms',
    exitRoot: 'transform-origin: var(--ac-disc-x) 50%;',
    exitRules: `
      ${LIVE_TOAST} .ac-in-unfold .ac-text {
        animation:
          ${TEXT_IN},
          ac-text-out 140ms ${ACCELERATE} ${AT_EXIT} forwards;
      }
      @keyframes ac-text-out {
        to { opacity: 0; transform: translateX(-8px); }
      }
      @keyframes ac-out-unfold {
        0% {
          clip-path: ${OPEN_CLIP};
          animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.4);
        }
        62% {
          clip-path: ${DISC_CLIP};
          opacity: 1;
          transform: none;
          animation-timing-function: ${ACCELERATE};
        }
        100% {
          clip-path: ${DISC_CLIP};
          opacity: 0;
          transform: scale(0.6);
        }
      }`,
  },
  // PlayStation: settles down from above, with one pass of light around the
  // icon.
  drop: {
    card: [
      'ac-fade-in 200ms ease-out both',
      `ac-in-drop ${SPRING.drop.durationMs}ms ${SPRING.drop.easing} both`,
    ],
    enter: `
      .ac-toast:not(.ac-rare):not(.ac-ultra) .ac-in-drop .ac-ring {
        opacity: 1;
        background: conic-gradient(from 0deg, transparent 0 62%, rgb(255 255 255 / 0.85) 82%, transparent 100%);
        animation: ac-spin-once 1.1s ease-out 350ms both;
      }
      @keyframes ac-in-drop {
        from { translate: 0 calc(var(--ac-fall) * -1); }
        to   { translate: 0 0; }
      }
      @keyframes ac-spin-once {
        from { transform: rotate(0turn); opacity: 1; }
        to   { transform: rotate(1turn); opacity: 0; }
      }`,
    exit: `ac-out-drop 280ms ${ACCELERATE}`,
    exitRules: `
      @keyframes ac-out-drop {
        to { transform: translateY(calc(var(--ac-fall) * -1)); opacity: 0; }
      }`,
  },
  slide: {
    card: [
      'ac-fade-in 180ms ease-out both',
      `ac-in-slide ${SPRING.slide.durationMs}ms ${SPRING.slide.easing} both`,
    ],
    enter: `
      @keyframes ac-in-slide {
        from { translate: calc(var(--ac-dx) * 115%) 0; }
        to   { translate: 0 0; }
      }`,
    exit: `ac-out-slide 320ms ${ACCELERATE_HARD}`,
    exitRules: `
      @keyframes ac-out-slide {
        to { transform: translateX(calc(var(--ac-dx) * 115%)); }
      }`,
  },
  pop: {
    card: [
      'ac-fade-in 140ms ease-out both',
      `ac-in-pop ${SPRING.pop.durationMs}ms ${SPRING.pop.easing} both`,
    ],
    enter: '@keyframes ac-in-pop { from { scale: 0.5; } to { scale: 1; } }',
    exit: `ac-out-pop 220ms ${ACCELERATE}`,
    exitRules: `
      @keyframes ac-out-pop {
        to { transform: scale(0.82); opacity: 0; }
      }`,
  },
  // Gravity: two decaying bounces with squash and stretch; the exit hops, then
  // drops.
  bounce: {
    card: ['ac-in-bounce 950ms both'],
    enter: `
      .ac-in-bounce { transform-origin: 50% 100%; }
      @keyframes ac-in-bounce {
        0% {
          opacity: 0;
          translate: 0 calc(var(--ac-fall) * -1);
          scale: 0.98 1.02;
          animation-timing-function: ${ACCELERATE_HARD};
        }
        8% { opacity: 1; }
        34% {
          translate: 0 0;
          scale: 1.06 0.9;
          animation-timing-function: ${DECELERATE};
        }
        52% {
          translate: 0 calc(var(--ac-fall) * -0.35);
          scale: 0.98 1.03;
          animation-timing-function: ${ACCELERATE_HARD};
        }
        68% {
          translate: 0 0;
          scale: 1.03 0.95;
          animation-timing-function: ${DECELERATE};
        }
        80% {
          translate: 0 calc(var(--ac-fall) * -0.12);
          scale: 1 1;
          animation-timing-function: ${ACCELERATE_HARD};
        }
        90%  { translate: 0 0; scale: 1.01 0.98; }
        100% { opacity: 1; translate: 0 0; scale: 1 1; }
      }`,
    exit: 'ac-out-bounce 420ms',
    exitRules: `
      @keyframes ac-out-bounce {
        0% { transform: none; animation-timing-function: ${DECELERATE}; }
        30% {
          transform: translateY(calc(var(--ac-fall) * -0.5)) scale(1.02, 0.98);
          animation-timing-function: ${ACCELERATE_HARD};
        }
        100% { transform: translateY(var(--ac-fall)); opacity: 0; }
      }`,
  },
  fade: {
    card: [`ac-in-fade 520ms ${EASE_OUT} both`],
    enter: `
      @keyframes ac-in-fade {
        from { opacity: 0; filter: blur(10px); scale: 1.05; }
        to   { opacity: 1; filter: none; scale: 1; }
      }`,
    exit: `ac-out-fade 320ms ${ACCELERATE}`,
    exitRules: `
      @keyframes ac-out-fade {
        to { opacity: 0; filter: blur(8px); transform: scale(0.97); }
      }`,
  },
  // A sign on a hinge: swings down from the top edge, then flips away.
  flip: {
    card: [
      'ac-fade-in 160ms ease-out both',
      `ac-in-flip ${SPRING.flip.durationMs}ms ${SPRING.flip.easing} both`,
    ],
    enter: `
      .ac-in-flip { transform-origin: 50% 0; }
      @keyframes ac-in-flip {
        from { transform: perspective(700px) rotateX(-100deg); }
        to   { transform: perspective(700px) rotateX(0deg); }
      }`,
    exit: `ac-out-flip 340ms ${ACCELERATE_HARD}`,
    exitRoot: 'transform-origin: 50% 100%;',
    exitRules: `
      @keyframes ac-out-flip {
        to { transform: perspective(700px) rotateX(95deg); opacity: 0; }
      }`,
  },
  // 16-bit text box: opens from a dot to a line to full height in hard steps,
  // content after.
  retro: {
    card: ['ac-in-retro 420ms both'],
    enter: `
      .ac-in-retro .ac-icon, .ac-in-retro .ac-text { animation: ${RETRO_SHOW}; }
      @keyframes ac-in-retro {
        0%   { scale: 0.04 0.06; animation-timing-function: steps(4, end); }
        45%  { scale: 1 0.06; animation-timing-function: steps(4, end); }
        100% { scale: 1 1; }
      }
      @keyframes ac-retro-show { from { opacity: 0; } to { opacity: 1; } }`,
    exit: 'ac-out-retro 300ms',
    exitRules: `
      ${LIVE_TOAST} .ac-in-retro .ac-icon, ${LIVE_TOAST} .ac-in-retro .ac-text {
        animation: ${RETRO_SHOW}, ac-retro-clear 1ms ${AT_EXIT} forwards;
      }
      @keyframes ac-retro-clear { to { opacity: 0; } }
      @keyframes ac-out-retro {
        0% {
          transform: scale(1, 1);
          animation-timing-function: steps(3, end);
        }
        55% {
          transform: scale(1, 0.06);
          animation-timing-function: steps(3, end);
        }
        99%  { transform: scale(0.04, 0.06); opacity: 1; }
        100% { transform: scale(0.04, 0.06); opacity: 0; }
      }`,
  },
};

const PLAIN_EXIT = 'ac-out 300ms ease-in';
const PLAIN_EXIT_KEYFRAMES = `
  @keyframes ac-out {
    to { opacity: 0; transform: translateX(calc(var(--ac-dx) * 20px)); }
  }`;

/**
 * Returns the CSS for an entrance (or none) and its matching exit; the rarity
 * pulse is appended to the card animations.
 */
export function motionCss(
  style: EntranceStyle | null,
  pulse: string | null,
): MotionParts {
  const entrance = style ? ENTRANCES[style] : null;
  const cardRule = (list: string[]): string => {
    const animations = pulse ? [...list, pulse] : list;
    const value = animations.length > 0 ? animations.join(', ') : 'none';
    return `.ac-card { animation: ${value}; }`;
  };
  // !important: the root is GamepadToastPopup's direct child, which Steam
  // animates itself.
  const exitRule = (animation: string, root = ''): string =>
    `${LIVE_TOAST} { ${root} animation: ${animation} ${AT_EXIT} forwards !important; }`;
  const full = entrance
    ? `${cardRule(entrance.card)}
      ${entrance.enter}
      ${exitRule(entrance.exit, entrance.exitRoot)}
      ${entrance.exitRules}`
    : `${cardRule([])}
      ${exitRule(PLAIN_EXIT)}
      ${PLAIN_EXIT_KEYFRAMES}`;
  return {
    always: `
      .ac-toast { --ac-disc-x: 38px; --ac-disc-r: 32px; --ac-fall: 18px; }
      .ac-toast.ac-compact { --ac-disc-x: 32px; --ac-disc-r: 26px; --ac-fall: 6px; }
      .ac-toast[data-edge~="ingame"]:not([data-edge~="top"]) { --ac-fall: 6px; }
      @keyframes ac-fade-in { from { opacity: 0; } }`,
    full,
    reduced: `
      ${cardRule(entrance ? ['ac-fade-in 200ms ease-out both'] : [])}
      ${exitRule('ac-rm-out 250ms ease-out')}
      @keyframes ac-rm-out { to { opacity: 0; } }`,
  };
}
