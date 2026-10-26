/**
 * @fileoverview Entrance and exit animations. Springs use Motion's maths,
 * precomputed into CSS `linear()` easings.
 */

import {
  FIREBALL_COLORS,
  fireballFrames,
  rowsSprite,
} from './decorations/pixel_art';
import type {EntranceStyle, TrophyReveal} from './settings';

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
  /** Animations on .ac-card. */
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
// Moves the card so its icon disc sits at the card's centre.
const DISC_AT_CENTER = 'calc(50% - var(--ac-disc-x))';
const TEXT_RISE =
  'ac-text-rise 420ms cubic-bezier(0.2, 0.8, 0.2, 1) 700ms both';
// Retro keeps the icon and text hidden until its box has opened.
const RETRO_MS = 420;
const RETRO_SHOW = `ac-retro-show ${RETRO_MS}ms steps(1, end) both`;

// Vertical travel (--ac-fall) goes toward the nearest screen edge and stays
// inside the toast window: a centred card has ~21px on either side, a compact
// one ~8px. --ac-side is -1 at the top and 1 at the bottom; --ac-dx/--ac-dy
// point from the card to the edge it slides in from.
const ENTRANCES: Record<EntranceStyle, EntranceMotion> = {
  // Xbox One: the icon disc pops in at the centre with two ripples, then rides
  // to the left end while the pill grows out of it; the exit runs it back.
  unfold: {
    card: ['ac-in-unfold 1100ms both'],
    enter: `
      .ac-in-unfold { transform-origin: var(--ac-disc-x) 50%; }
      .ac-in-unfold .ac-text { animation: ${TEXT_RISE}; }
      .ac-in-unfold .ac-icon::before, .ac-in-unfold .ac-icon::after {
        content: "";
        position: absolute;
        inset: -8px;
        z-index: -1;
        border-radius: 50%;
        background: rgb(var(--ac-accent-rgb) / 0.6);
        opacity: 0;
        animation: ac-ripple 600ms ease-out both;
      }
      .ac-compact .ac-in-unfold .ac-icon::before,
      .ac-compact .ac-in-unfold .ac-icon::after { inset: -6px; }
      .ac-in-unfold .ac-icon::after {
        background: rgb(var(--ac-accent-rgb) / 0.35);
        animation-delay: 100ms;
      }
      @keyframes ac-in-unfold {
        0% {
          opacity: 0;
          scale: 0.1;
          translate: ${DISC_AT_CENTER} 0;
          clip-path: ${DISC_CLIP};
          animation-timing-function: ${DECELERATE};
        }
        9%  { opacity: 1; }
        15% { scale: 1.1; animation-timing-function: ease-in-out; }
        21% { scale: 1; }
        34% {
          translate: ${DISC_AT_CENTER} 0;
          clip-path: ${DISC_CLIP};
          animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
        }
        80%, 100% {
          opacity: 1;
          scale: 1;
          translate: 0 0;
          clip-path: ${OPEN_CLIP};
        }
      }
      @keyframes ac-ripple {
        0%   { opacity: 0; scale: 0.1; }
        30%  { opacity: 1; }
        80%  { opacity: 0.8; scale: 1; }
        100% { opacity: 0; scale: 1; }
      }
      @keyframes ac-text-rise {
        from { opacity: 0; transform: translateY(14px); }
      }`,
    exit: 'ac-out-unfold 460ms',
    exitRoot: 'transform-origin: var(--ac-disc-x) 50%;',
    exitRules: `
      ${LIVE_TOAST} .ac-in-unfold .ac-text {
        animation:
          ${TEXT_RISE},
          ac-text-out 140ms ${ACCELERATE} ${AT_EXIT} forwards;
      }
      @keyframes ac-text-out {
        to { opacity: 0; transform: translateY(-12px); }
      }
      @keyframes ac-out-unfold {
        0% {
          clip-path: ${OPEN_CLIP};
          transform: translateX(0) scale(1);
          animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
        }
        62% {
          clip-path: ${DISC_CLIP};
          opacity: 1;
          transform: translateX(${DISC_AT_CENTER}) scale(1);
          animation-timing-function: ease-out;
        }
        75% {
          transform: translateX(${DISC_AT_CENTER}) scale(1.1);
          animation-timing-function: ${ACCELERATE};
        }
        100% {
          clip-path: ${DISC_CLIP};
          opacity: 0;
          transform: translateX(${DISC_AT_CENTER}) scale(0.1);
        }
      }`,
  },
  // PlayStation: settles in from the nearest screen edge, with one pass of
  // light around the icon.
  drop: {
    card: [
      'ac-fade-in 200ms ease-out both',
      `ac-in-drop ${SPRING.drop.durationMs}ms ${SPRING.drop.easing} both`,
    ],
    enter: `
      .ac-toast:not(.ac-gold):not(.ac-platinum) .ac-in-drop .ac-ring {
        opacity: 1;
        --ac-ring-light: conic-gradient(from 0deg, transparent 0 62%, rgb(255 255 255 / 0.85) 82%, transparent 100%);
      }
      .ac-toast:not(.ac-gold):not(.ac-platinum) .ac-in-drop .ac-ring::before {
        animation: ac-spin-once 1.1s ease-out 350ms both;
      }
      @keyframes ac-in-drop {
        from { translate: 0 calc(var(--ac-fall) * var(--ac-side)); }
        to   { translate: 0 0; }
      }
      @keyframes ac-spin-once {
        from { transform: rotate(0turn); opacity: 1; }
        to   { transform: rotate(1turn); opacity: 0; }
      }`,
    exit: `ac-out-drop 280ms ${ACCELERATE}`,
    exitRules: `
      @keyframes ac-out-drop {
        to {
          transform: translateY(calc(var(--ac-fall) * var(--ac-side)));
          opacity: 0;
        }
      }`,
  },
  slide: {
    card: [
      'ac-fade-in 180ms ease-out both',
      `ac-in-slide ${SPRING.slide.durationMs}ms ${SPRING.slide.easing} both`,
    ],
    enter: `
      @keyframes ac-in-slide {
        from { translate: calc(var(--ac-dx) * 115%) calc(var(--ac-dy) * 115%); }
        to   { translate: 0 0; }
      }`,
    exit: `ac-out-slide 320ms ${ACCELERATE_HARD}`,
    exitRules: `
      @keyframes ac-out-slide {
        to {
          transform: translate(calc(var(--ac-dx) * 115%), calc(var(--ac-dy) * 115%));
        }
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
  // Gravity toward the nearest screen edge: two decaying bounces with squash
  // and stretch; the exit hops away from the edge, then falls toward it.
  bounce: {
    card: ['ac-in-bounce 950ms both'],
    enter: `
      .ac-in-bounce { transform-origin: 50% calc(50% - 50% * var(--ac-side)); }
      @keyframes ac-in-bounce {
        0% {
          opacity: 0;
          translate: 0 calc(var(--ac-fall) * var(--ac-side));
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
          translate: 0 calc(var(--ac-fall) * 0.35 * var(--ac-side));
          scale: 0.98 1.03;
          animation-timing-function: ${ACCELERATE_HARD};
        }
        68% {
          translate: 0 0;
          scale: 1.03 0.95;
          animation-timing-function: ${DECELERATE};
        }
        80% {
          translate: 0 calc(var(--ac-fall) * 0.12 * var(--ac-side));
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
          transform: translateY(calc(var(--ac-fall) * -0.35 * var(--ac-side)))
            scale(1.02, 0.98);
          animation-timing-function: ${ACCELERATE_HARD};
        }
        100% {
          transform: translateY(calc(var(--ac-fall) * var(--ac-side)));
          opacity: 0;
        }
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
  // A sign hinged on the edge nearest the screen's: swings in, then flips away.
  flip: {
    card: [
      'ac-fade-in 160ms ease-out both',
      `ac-in-flip ${SPRING.flip.durationMs}ms ${SPRING.flip.easing} both`,
    ],
    enter: `
      .ac-in-flip { transform-origin: 50% calc(50% + 50% * var(--ac-side)); }
      @keyframes ac-in-flip {
        from { transform: perspective(700px) rotateX(calc(var(--ac-side) * 100deg)); }
        to   { transform: perspective(700px) rotateX(0deg); }
      }`,
    exit: `ac-out-flip 340ms ${ACCELERATE_HARD}`,
    exitRoot: 'transform-origin: 50% calc(50% - 50% * var(--ac-side));',
    exitRules: `
      @keyframes ac-out-flip {
        to {
          transform: perspective(700px) rotateX(calc(var(--ac-side) * -95deg));
          opacity: 0;
        }
      }`,
  },
  // 16-bit text box: opens from a dot to a line to full height in hard steps,
  // content after.
  retro: {
    card: [`ac-in-retro ${RETRO_MS}ms both`],
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
    to {
      opacity: 0;
      transform: translate(calc(var(--ac-dx) * 20px), calc(var(--ac-dy) * 20px));
    }
  }`;

/** Returns the CSS for an entrance (or none) and its matching exit. */
export function motionCss(style: EntranceStyle | null): MotionParts {
  const entrance = style ? ENTRANCES[style] : null;
  const cardRule = (list: string[]): string =>
    `.ac-card { animation: ${list.length > 0 ? list.join(', ') : 'none'}; }`;
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
      .ac-toast {
        --ac-disc-x: 38px;
        --ac-disc-r: 32px;
        --ac-fall: 18px;
        --ac-side: 1;
        --ac-dx: 1;
        --ac-dy: 0;
      }
      .ac-toast.ac-compact { --ac-disc-x: 32px; --ac-disc-r: 26px; --ac-fall: 6px; }
      .ac-toast[data-edge~="top"] { --ac-side: -1; }
      .ac-toast[data-edge~="left"] { --ac-dx: -1; }
      .ac-toast[data-edge~="center"] { --ac-dx: 0; --ac-dy: var(--ac-side); }
      @keyframes ac-fade-in { from { opacity: 0; } }`,
    full,
    reduced: `
      ${cardRule(entrance ? ['ac-fade-in 200ms ease-out both'] : [])}
      ${exitRule('ac-rm-out 250ms ease-out')}
      @keyframes ac-rm-out { to { opacity: 0; } }`,
  };
}

// The earliest a reveal starts: every entrance has settled (Xbox One opens its
// pill by ~880 ms).
const EARLIEST_REVEAL_MS = 1100;
const REVEAL_FACE = '.ac-reveal .ac-face';
const REVEAL_TROPHY = '.ac-reveal .ac-trophy';
const REVEAL_FX = '.ac-reveal .ac-reveal-fx';
const ICON_SIZE = 'var(--ac-icon-size)';

// Two faces with hidden backs: the icon turns away while the trophy turns in.
function flipReveal(
  degrees: number,
  durationMs: number,
  easing: string,
  start: number,
): string {
  const timing = `${durationMs}ms ${easing} ${start}ms both`;
  return `
    ${REVEAL_FACE}, ${REVEAL_TROPHY} { backface-visibility: hidden; }
    ${REVEAL_FACE} { animation: ac-face-out-${degrees} ${timing}; }
    ${REVEAL_TROPHY} { animation: ac-face-in-${degrees} ${timing}; }
    @keyframes ac-face-out-${degrees} {
      from { transform: perspective(300px) rotateY(0deg); }
      to   { transform: perspective(300px) rotateY(${degrees}deg); }
    }
    @keyframes ac-face-in-${degrees} {
      from { transform: perspective(300px) rotateY(-${degrees}deg); }
      to   { transform: perspective(300px) rotateY(0deg); }
    }`;
}

/** A data URI of ASCII pixel art; each character in `colors` paints its cells. */
function pixelSvg(rows: string[], colors: Record<string, string>): string {
  const paths = Object.entries(colors).map(([char, fill]) => {
    const cells = rows
      .flatMap((row, y) =>
        [...row].map((cell, x) => (cell === char ? `M${x} ${y}h1v1h-1z` : '')),
      )
      .join('');
    return cells ? `<path fill="${fill}" d="${cells}"/>` : '';
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${paths.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Keyframes that switch layers on one per step, in order; `property` lists each
// layer's size once it is on and `0 0` before.
function layerSteps(
  name: string,
  property: string,
  sizes: string[],
  steps: number,
  fixed = '',
): string {
  const frames = [...Array(steps + 1).keys()].map((shown) => {
    const list = sizes.map((size, i) => (i < shown ? size : '0 0'));
    return `${(shown * 100) / steps}% { ${property}: ${fixed}${list.join(', ')}; }`;
  });
  return `@keyframes ac-${name} { ${frames.join('\n')} }`;
}

const SOLID = 'linear-gradient(#000 0 0)';
const FX_LIFE =
  '@keyframes ac-fx-life { from { opacity: 1; } to { opacity: 0; } }';

// Little pixel aliens eat the art from the bottom-left corner to the top-right
// one: a staircase twice as wide as the icon slides right one eighth of the
// icon per step, and the aliens ride its edge, more of them where it is longer.
const EAT_STEPS = 16;
const EAT_MS = 70;
// Row r of the staircase covers r + 9 of its 16 columns. Gradients, unlike an
// image mask, apply from the first frame: Chrome paints an undecoded mask image
// as no mask, which showed the trophy early under Retro's hidden icon.
const STAIR_ROWS = [...Array(8).keys()];
// Two frames: antennae and legs wiggle while the mouth chomps.
const ALIEN_CHOMP = ['#...#', '.###.', '#E#E#', '##M##', '.#.#.'];
const ALIEN_SHUT = ['.#.#.', '.###.', '#E#E#', '#####', '#...#'];
// Offset of each alien along the edge, in eighths of the icon, and its body in
// the achievement's tier colors.
const ALIENS: Array<[number, string]> = [
  [-3, 'var(--ac-tier-light)'],
  [-1, 'var(--ac-tier)'],
  [1, 'var(--ac-tier)'],
  [3, 'var(--ac-tier-light)'],
];

function pixelsReveal(start: number): string {
  const eighth = `${ICON_SIZE} / 8`;
  const timing = `${EAT_STEPS * EAT_MS}ms steps(1, end) ${start}ms`;
  const aliens = ALIENS.map(([offset, body], n) => {
    // Step j eats the cells with column - row = j - 7; the 10px alien sits
    // centred on that edge, hidden while it is off the icon.
    const frames = [...Array(EAT_STEPS).keys()].map((j) => {
      const x = (j + 1) / 2 + offset;
      const y = (15 - j) / 2 + offset;
      const inside = x >= 0 && x <= 8 && y >= 0 && y <= 8;
      return `${(j * 100) / EAT_STEPS}% {
        opacity: ${inside ? 1 : 0};
        translate: calc(${eighth} * ${x} - 5px) calc(${eighth} * ${y} - 5px);
      }`;
    });
    const palette = {'#': body, 'E': '#111', 'M': '#2a0a12'};
    return `
      ${REVEAL_FX} i:nth-child(${n + 1}) {
        animation:
          ac-alien-${n} ${timing} both,
          ac-chomp-${n} ${EAT_MS * 2}ms steps(1, end) ${start + n * EAT_MS}ms ${EAT_STEPS / 2};
      }
      @keyframes ac-alien-${n} { ${frames.join('\n')} 100% { opacity: 0; } }
      @keyframes ac-chomp-${n} {
        0%  { box-shadow: ${rowsSprite(ALIEN_CHOMP, palette).join(', ')}; }
        50% { box-shadow: ${rowsSprite(ALIEN_SHUT, palette).join(', ')}; }
      }`;
  });
  const stairsAt = (x: string): string =>
    STAIR_ROWS.map((row) => `${x} calc(${eighth} * ${row})`).join(', ');
  return `
    ${REVEAL_TROPHY} {
      -webkit-mask-image: ${STAIR_ROWS.map(() => SOLID).join(', ')};
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-size: ${STAIR_ROWS.map((row) => `calc(${eighth} * ${row + 9}) calc(${eighth})`).join(', ')};
      animation: ac-eaten ${EAT_STEPS * EAT_MS}ms steps(${EAT_STEPS}, end) ${start}ms both;
    }
    @keyframes ac-eaten {
      from { -webkit-mask-position: ${stairsAt(`calc(${ICON_SIZE} * -2)`)}; }
      to   { -webkit-mask-position: ${stairsAt('0px')}; }
    }
    ${REVEAL_FX} { animation: ac-fx-life ${timing} forwards; }
    ${FX_LIFE}
    ${aliens.join('')}`;
}

// The art takes a volley of laser bolts from the right: each burns a glowing
// scorch mark, with a flash and a kick, then the pixel fireball blows the art
// away and leaves the trophy standing in the smoke.
const LASER_GAP_MS = 110;
const LASER_FLIGHT_MS = 60;
const FIREBALL_FRAME_MS = 80;
const LASER_HITS: Array<[number, number]> = [
  [0.66, 0.34],
  [0.34, 0.6],
  [0.72, 0.7],
  [0.42, 0.24],
  [0.26, 0.8],
];
const KICKS: Array<[number, number]> = [
  [2, -1],
  [-2, 1],
  [1, 2],
  [-1, -2],
  [2, 1],
  [-2, -1],
  [1, 2],
];
// K: charred core, D: burn, O and o: glowing and cooling embers, y: sparks.
const SCORCH = [
  '...o.y....',
  '..oyOyo...',
  '.oO.KK.oy.',
  'yOKKKKKOo.',
  '.oKKDDKKO.',
  'oyKDDDKKy.',
  '.OKKDKKOo.',
  '..oKKKO.y.',
  '.y.oOo....',
  '....y.....',
];
const SCORCH_COLORS = {
  K: '#1a0a06',
  D: '#3a1208',
  O: '#ff7a1a',
  o: '#b8360f',
  y: '#ffd34d',
};
const FLASH = ['..o..', '.oWo.', 'oWWWo', '.oWo.', '..o..'];
const FLASH_COLORS = {o: '#ffcf4a', W: '#ffffff'};
const LASER = rowsSprite(['rRRWWRRr'], {
  r: '#a80000',
  R: '#ff2b2b',
  W: '#ffd6d6',
}).join(', ');

const SETTLE_MS = 300;
// From the first bolt until the trophy has settled.
const LASER_MS =
  2 * LASER_FLIGHT_MS +
  (LASER_HITS.length - 1) * LASER_GAP_MS +
  fireballFrames().length * FIREBALL_FRAME_MS +
  SETTLE_MS;

function laserReveal(start: number): string {
  const at = (fraction: number, half: number): string =>
    `calc(${ICON_SIZE} * ${fraction} - ${half}px)`;
  const impact = (k: number): number =>
    start + LASER_FLIGHT_MS + k * LASER_GAP_MS;
  const bolts = LASER_HITS.map(
    ([x, y], k) => `
      ${REVEAL_FX} i:nth-child(${k + 1}) {
        z-index: 2;
        box-shadow: ${LASER};
        animation: ac-laser-${k} ${LASER_FLIGHT_MS + 10}ms linear ${impact(k) - LASER_FLIGHT_MS}ms both;
      }
      @keyframes ac-laser-${k} {
        0% { opacity: 1; translate: calc(${ICON_SIZE} + 2px) ${at(y, 1)}; }
        85% { opacity: 1; translate: ${at(x, 0)} ${at(y, 1)}; }
        100% { opacity: 0; translate: ${at(x, 0)} ${at(y, 1)}; }
      }`,
  );
  // Scorches, flashes and kicks share a clock of one step per bolt, the first
  // a step before the first impact.
  const steps = LASER_HITS.length + 1;
  const clock = `${steps * LASER_GAP_MS}ms steps(1, end) ${impact(0) - LASER_GAP_MS}ms`;
  const share = (step: number, of = steps): number =>
    Math.round((step * 10000) / of) / 100;
  const flashes = LASER_HITS.map(
    ([x, y], k) => `
      ${share(k + 1)}% { opacity: 1; translate: ${at(x, 5)} ${at(y, 5)}; }
      ${share(k + 1.45)}% { opacity: 0; }`,
  );
  const kicks = KICKS.slice(0, LASER_HITS.length).map(
    ([x, y], k) => `
      ${share(k + 1)}% { translate: ${x}px ${y}px; }
      ${share(k + 1.5)}% { translate: 0 0; }`,
  );
  const scorch = pixelSvg(SCORCH, SCORCH_COLORS);
  // The fireball starts as the last bolt lands, hides the art and its
  // scorches at its peak and has burnt away to smoke over the trophy by the
  // sixth frame.
  const frames = fireballFrames();
  const sheet = pixelSvg(
    [...frames[0].keys()].map((y) => frames.map((frame) => frame[y]).join('')),
    FIREBALL_COLORS,
  );
  const boom = impact(LASER_HITS.length - 1) + LASER_FLIGHT_MS;
  const gone = boom + 2 * FIREBALL_FRAME_MS;
  const cleared = boom + frames.length * FIREBALL_FRAME_MS;
  const fire = [...frames.keys()]
    .slice(1)
    .map(
      (k) =>
        `${share(k, frames.length)}% { translate: calc(${ICON_SIZE} * ${-k}) 0; }`,
    );
  return `
    ${REVEAL_FACE} {
      position: relative;
      z-index: 1;
      animation: ac-kick ${clock} both, ac-gone 1ms ${gone}ms both;
    }
    ${REVEAL_FX} {
      z-index: 2;
      animation: ac-fx-life ${cleared - start}ms steps(1, end) ${start}ms forwards;
    }
    ${FX_LIFE}
    ${bolts.join('')}
    ${REVEAL_FX} i:nth-child(6) {
      z-index: 3;
      box-shadow: ${rowsSprite(FLASH, FLASH_COLORS).join(', ')};
      animation: ac-flash ${clock} both;
    }
    ${REVEAL_FX} i:nth-child(7) {
      z-index: 4;
      width: calc(${ICON_SIZE} * ${frames.length});
      height: ${ICON_SIZE};
      background: ${sheet} 0 0 / 100% 100% no-repeat;
      opacity: 0;
      animation: ac-fireball ${frames.length * FIREBALL_FRAME_MS}ms steps(1, end) ${boom}ms forwards;
    }
    ${REVEAL_FX} i:nth-child(8) {
      z-index: 1;
      width: ${ICON_SIZE};
      height: ${ICON_SIZE};
      background-image: ${LASER_HITS.map(() => scorch).join(', ')};
      background-repeat: no-repeat;
      background-position: ${LASER_HITS.map(([x, y]) => `${at(x, 10)} ${at(y, 10)}`).join(', ')};
      animation: ac-scorch ${clock} both, ac-gone 1ms ${gone}ms both;
    }
    ${layerSteps(
      'scorch',
      'background-size',
      LASER_HITS.map(() => '20px 20px'),
      steps,
    )}
    ${REVEAL_TROPHY} {
      animation: ac-settle ${SETTLE_MS}ms ${EASE_OUT} ${cleared}ms both;
    }
    @keyframes ac-gone { to { opacity: 0; } }
    @keyframes ac-fireball {
      0% { opacity: 1; translate: 0 0; }
      ${fire.join('\n')}
      100% { opacity: 0; translate: calc(${ICON_SIZE} * ${1 - frames.length}) 0; }
    }
    @keyframes ac-settle { from { scale: 0.9; } to { scale: 1; } }
    @keyframes ac-kick { 0% { translate: 0 0; } ${kicks.join('')} }
    @keyframes ac-flash { 0% { opacity: 0; } ${flashes.join('')} }`;
}

// Blood pours down over the art in columns that race each other, each led by
// a glossy bulb, until it is covered; then it fades away over the trophy so
// the red turns into the tier's colors. Shorter toasts play the whole timeline,
// from the toast's arrival, faster so the trophy still shows before the exit.
const BLOOD = '#9f0000';
const POUR_EASE = 'cubic-bezier(0.34, 0.03, 0.76, 0.94)';
const BULB_PX = 9;
const TURN_MS = 600;
const BLOOD_REST_MS = 300;
// One per `.ac-reveal-fx i`, side by side: left and width (% of the icon),
// start (ms after the reveal starts) and run (ms).
const COLUMNS: Array<[number, number, number, number]> = [
  [0, 12, 0, 1950],
  [12, 14, 200, 2340],
  [26, 11, 270, 1560],
  [37, 13, 290, 2410],
  [50, 12, 450, 1760],
  [62, 11, 250, 2150],
  [73, 14, 330, 2250],
  [87, 13, 410, 2010],
];
const BLOOD_MS =
  Math.max(...COLUMNS.map(([, , at, run]) => at + run)) + TURN_MS;

function bloodReveal(start: number, durationMs: number): string {
  const scale = Math.min(1, (durationMs - BLOOD_REST_MS) / (start + BLOOD_MS));
  const ms = (value: number): number => Math.floor(value * scale);
  const covered = Math.max(
    ...COLUMNS.map(([, , at, run]) => ms(start + at) + ms(run)),
  );
  // Columns overlap by a pixel so no seam shows between them.
  const columns = COLUMNS.map(
    ([left, width, at, run], n) => `
      ${REVEAL_FX} i:nth-child(${n + 1}) {
        left: ${left}%;
        width: calc(${width}% + 1px);
        animation: ac-blood-pour ${ms(run)}ms ${POUR_EASE} ${ms(start + at)}ms both;
      }`,
  );
  // Each column hangs from above the icon, so sliding it down reads as
  // pouring; its body stops at the middle of its wider bulb.
  return `
    ${REVEAL_TROPHY} {
      animation: ac-fade-in ${covered}ms steps(1, end) both;
    }
    ${REVEAL_FX} {
      animation: ac-fx-life ${ms(TURN_MS)}ms ease-in-out ${covered}ms both;
    }
    ${FX_LIFE}
    ${REVEAL_FX} i {
      height: calc(100% + ${BULB_PX}px);
      background: linear-gradient(${BLOOD} 0 0) 0 0 / 100% calc(100% - ${BULB_PX / 2}px) no-repeat;
    }
    ${REVEAL_FX} i::before {
      content: "";
      position: absolute;
      left: -15%;
      bottom: 0;
      width: 130%;
      height: ${BULB_PX}px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 38% 32%, transparent 50%, rgb(255 255 255 / 0.5) 64%, transparent 76%),
        ${BLOOD};
    }
    ${columns.join('')}
    @keyframes ac-blood-pour { from { translate: 0 -100%; } }`;
}

// Each reveal's length (ms, from its start until the trophy is at rest) and
// its CSS for a start time and the toast's display time.
const REVEALS: Record<
  Exclude<TrophyReveal, 'off'>,
  [number, (start: number, durationMs: number) => string]
> = {
  spin: [
    700,
    (start) => flipReveal(180, 700, 'cubic-bezier(0.45, 0, 0.2, 1)', start),
  ],
  // Five and a half turns that slow down to land on the trophy.
  coin: [
    1600,
    (start) => flipReveal(1980, 1600, 'cubic-bezier(0.3, 0.55, 0.3, 1)', start),
  ],
  pixels: [EAT_STEPS * EAT_MS, pixelsReveal],
  bullets: [LASER_MS, laserReveal],
  blood: [BLOOD_MS, bloodReveal],
};

/**
 * Returns the CSS that turns the icon into its tier trophy. The trophy covers
 * the icon at rest, so every mode ends on it; Blood paces itself to end
 * within `durationMs`, the toast's display time.
 */
export function revealCss(
  style: TrophyReveal,
  durationMs: number,
): MotionParts {
  if (style === 'off') return {always: '', full: '', reduced: ''};
  const [length, css] = REVEALS[style];
  // Centred in the display time so the icon and the trophy each show for
  // about half of it, but never before the entrance has settled.
  const startOf = (ms: number): number =>
    Math.max(EARLIEST_REVEAL_MS, Math.round((durationMs - ms) / 2));
  return {
    always: `
      .ac-reveal { --ac-icon-size: 48px; }
      .ac-reveal.ac-compact { --ac-icon-size: 40px; }
      .ac-reveal-fx {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--ac-icon-size);
        height: var(--ac-icon-size);
        border-radius: inherit;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }
      .ac-reveal-fx i { position: absolute; left: 0; top: 0; width: 0; height: 0; }`,
    full: css(startOf(length), durationMs),
    reduced: `${REVEAL_TROPHY} { animation: ac-fade-in 300ms ease-out ${startOf(300)}ms both; }`,
  };
}
