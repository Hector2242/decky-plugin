/**
 * @fileoverview Helpers for the 16-bit scenes. Each art pixel is a box-shadow
 * (offset to its centre, half its size as spread) of a 0x0 element, so a
 * sprite paints once and only ever moves on the compositor.
 */

import type {JSX} from 'react';

/** Where a sprite is drawn and how big its pixels are. */
interface SpriteOptions {
  /** Offset of the sprite's first column, in art px. */
  left?: number;
  /** Offset of the sprite's first row, in art px. */
  top?: number;
  /** CSS px per art pixel: 2 for most scenes, 1 for Halloween. */
  scale?: number;
}

/** Returns the box-shadow of one art pixel at (x, y). */
export function pixel(x: number, y: number, color: string, scale = 2): string {
  const half = scale / 2;
  return `${x * scale + half}px ${y * scale + half}px 0 ${half}px ${color}`;
}

/**
 * Converts ASCII art into box-shadows: each character is looked up in
 * `palette`, and characters missing from it stay transparent.
 */
export function rowsSprite(
  rows: string[],
  palette: Record<string, string>,
  {left = 0, top = 0, scale = 2}: SpriteOptions = {},
): string[] {
  const out: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color) out.push(pixel(x + left, y + top, color, scale));
    }
  });
  return out;
}

interface GridOptions {
  /** First row and column; below 0 reaches past the sprite's anchor. */
  from?: number;
  /** CSS px per art pixel. */
  scale?: number;
}

/** Returns a size x size block of art pixels colored by `colorAt`. */
export function gridSprite(
  size: number,
  colorAt: (x: number, y: number) => string | null,
  {from = 0, scale = 2}: GridOptions = {},
): string {
  const out: string[] = [];
  for (let y = from; y < from + size; y++) {
    for (let x = from; x < from + size; x++) {
      const color = colorAt(x, y);
      if (color) out.push(pixel(x, y, color, scale));
    }
  }
  return out.join(', ');
}

/**
 * Returns the clip-path of a flat shape given as a [top, bottom) span per 1px
 * column. Every edge sits on whole pixels, so a solid span clipped with it
 * paints as crisp as the same shape in box-shadows, at a fraction of the CSS.
 */
export function columnClip(columns: Array<[number, number]>): string {
  const length = (n: number): string => (n === 0 ? '0' : `${n}px`);
  // Merges runs of equal height into one edge each: [x0, x1, y].
  const edgesOf = (side: 0 | 1): Array<[number, number, number]> => {
    const edges: Array<[number, number, number]> = [];
    for (let x = 0; x < columns.length; x++) {
      const last = edges[edges.length - 1];
      if (last && last[2] === columns[x][side]) {
        last[1] = x + 1;
      } else {
        edges.push([x, x + 1, columns[x][side]]);
      }
    }
    return edges;
  };
  const top = edgesOf(0).flatMap(([x0, x1, y]) => [
    `${length(x0)} ${length(y)}`,
    `${length(x1)} ${length(y)}`,
  ]);
  const bottom = edgesOf(1)
    .reverse()
    .flatMap(([x0, x1, y]) => [
      `${length(x1)} ${length(y)}`,
      `${length(x0)} ${length(y)}`,
    ]);
  return `polygon(${[...top, ...bottom].join(', ')})`;
}

interface DiscOptions {
  body: string;
  rim: string;
  /** Distance from the centre, in art px, where the rim begins. */
  rimFrom: number;
  highlight?: (x: number, y: number) => boolean;
  highlightColor?: string;
  /** Spots win over the rim. */
  spots?: Array<[number, number]>;
  spotColor?: string;
}

/**
 * Returns a round sprite centred on a size x size grid, its edge 0.2 art px
 * beyond the outermost pixel centres.
 */
export function discSprite(size: number, options: DiscOptions): string {
  const centre = (size - 1) / 2;
  return gridSprite(size, (x, y) => {
    const distance = Math.hypot(x - centre, y - centre);
    if (distance > centre + 0.2) return null;
    const isSpot = options.spots?.some(([sx, sy]) => sx === x && sy === y);
    if (options.spotColor && isSpot) return options.spotColor;
    if (distance > options.rimFrom) return options.rim;
    if (options.highlightColor && options.highlight?.(x, y)) {
      return options.highlightColor;
    }
    return options.body;
  });
}

/** A straight limb: x0, y0, x1, y1, thickness, in art px. */
export type Limb = [number, number, number, number, number];

/**
 * Rasterizes straight limbs into `put`, shading each one lit top, middle,
 * underside (a single row uses the middle).
 */
export function drawLimbs(
  limbs: Limb[],
  put: (x: number, y: number, color: string) => void,
  shades: [string, string, string],
): void {
  const [lit, middle, underside] = shades;
  for (const [x0, y0, x1, y1, thickness] of limbs) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps - thickness / 2);
      for (let row = 0; row < thickness; row++) {
        let color = middle;
        if (thickness > 1 && row === 0) color = lit;
        if (thickness > 1 && row === thickness - 1) color = underside;
        put(x, y + row, color);
      }
    }
  }
}

/**
 * Joins three copies of a drifting layer, 146 art px (292 CSS px) apart, so
 * translating by -292px loops seamlessly on toasts and Quick Access previews
 * up to 584px wide.
 */
export function looped(build: (dx: number) => string[]): string {
  return [...build(0), ...build(146), ...build(292)].join(', ');
}

/**
 * Returns a seeded (mulberry32) random number generator, so every toast draws
 * exactly the same branches, petals and leaves.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pixel skies are four 20px bands like a 16-bit gradient, from --ac-px-b0
// (Secondary) at the top to --ac-px-b3 (Primary). Without color-mix() (older
// Steam clients) the middle bands snap to the nearer end.
const SUPPORTS_COLOR_MIX =
  typeof CSS === 'undefined' ||
  CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');
const BAND_1 = SUPPORTS_COLOR_MIX
  ? 'color-mix(in srgb, var(--ac-primary) 33%, var(--ac-secondary))'
  : 'var(--ac-secondary)';
const BAND_2 = SUPPORTS_COLOR_MIX
  ? 'color-mix(in srgb, var(--ac-primary) 67%, var(--ac-secondary))'
  : 'var(--ac-primary)';

/** The four-band sky background of the banded pixel themes. */
export const BANDS =
  'linear-gradient(180deg, var(--ac-px-b0) 0 20px, var(--ac-px-b1) 20px 40px, var(--ac-px-b2) 40px 60px, var(--ac-px-b3) 60px)';

/** 2px checkerboard strips over each band edge. */
export const DITHER = [0, 1, 2]
  .map(
    (i) => `
      .ac-px-decoration .ac-px-d${i + 1} {
        top: ${18 + i * 20}px;
        background: repeating-conic-gradient(var(--ac-px-b${i}) 0 25%, var(--ac-px-b${i + 1}) 0 50%) 0 0 / 4px 4px;
      }`,
  )
  .join('\n');

/** Band variables, sprite boxes and keyframes shared by every pixel theme. */
export const PIXEL_BASE = `
  .ac-toast {
    --ac-px-b0: var(--ac-secondary);
    --ac-px-b1: ${BAND_1};
    --ac-px-b2: ${BAND_2};
    --ac-px-b3: var(--ac-primary);
  }
  .ac-px-decoration span { position: absolute; display: block; }
  .ac-px-dither { left: 0; right: 0; height: 4px; }
  .ac-px-spr { width: 0; height: 0; }
  @keyframes ac-px-flap { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes ac-px-blink {
    0%  { opacity: 1; }
    30% { opacity: 0.35; }
    45% { opacity: 1; }
    70% { opacity: 0.5; }
    85% { opacity: 1; }
  }
  @keyframes ac-px-drift { to { translate: -292px 0; } }`;

interface FallingOptions {
  /** Class prefix: sprites are .ac-px-{name}, numbered .ac-px-{name}-1 and up. */
  name: string;
  count: number;
  seed: number;
  /** Two ASCII frames the sprite flutters between. */
  frames: [string[], string[]];
  /** Letter to color maps, cycled per sprite. */
  palettes: Array<Record<string, string>>;
  /** Where sprites start, in CSS px (even values). */
  area: {x: [number, number]; y: [number, number]};
  /** Seconds per fall. */
  cycle: [number, number];
  /** Travel per step in CSS px (multiples of 2). */
  vector: [number, number];
  steps: number;
}

/** Markup and CSS of a falling-sprite layer. */
interface FallingSprites {
  /** Called at render time. */
  markup: () => JSX.Element[];
  /** Hides the sprites and holds the flutter. */
  always: string;
  /** Holds the fall, so under Reduce Motion the sprites stay invisible. */
  full: string;
}

/** Builds sprites that flutter while falling in hard steps. */
export function fallingSprites(options: FallingOptions): FallingSprites {
  const random = seeded(options.seed);
  const [x0, x1] = options.area.x;
  const [y0, y1] = options.area.y;
  const [minCycle, maxCycle] = options.cycle;
  const sprites = Array.from({length: options.count}, () => {
    const cycle =
      Math.round((minCycle + random() * (maxCycle - minCycle)) * 10) / 10;
    return {
      cycle,
      x: Math.round(random() * ((x1 - x0) / 2)) * 2 + x0,
      y: Math.round(random() * ((y1 - y0) / 2)) * 2 + y0,
      delay: -Math.round(random() * cycle * 10) / 10,
    };
  });

  const name = options.name;
  const frameRules = options.palettes.map((palette, p) => {
    const [a, b] = options.frames.map((rows) =>
      rowsSprite(rows, palette).join(', '),
    );
    return `
      .ac-px-${name}-a${p} {
        box-shadow: ${a};
        animation: ac-px-flap 0.6s steps(1, end) infinite;
      }
      .ac-px-${name}-b${p} {
        box-shadow: ${b};
        animation: ac-px-flap 0.6s steps(1, end) -0.3s infinite;
      }`;
  });
  const startRules = sprites.map(
    (sprite, i) => `
      .ac-decoration .ac-px-${name}-${i + 1} {
        left: ${sprite.x}px;
        top: ${sprite.y}px;
        --ac-pt-t: ${sprite.cycle}s;
        --ac-pt-d: ${sprite.delay}s;
      }`,
  );
  const [stepX, stepY] = options.vector;

  return {
    markup: () =>
      [...sprites.keys()].map((i) => {
        const p = i % options.palettes.length;
        return (
          <span key={i} className={`ac-px-${name} ac-px-${name}-${i + 1}`}>
            <span className={`ac-px-spr ac-px-${name}-a${p}`} />
            <span className={`ac-px-spr ac-px-${name}-b${p}`} />
          </span>
        );
      }),
    always: `
      .ac-px-${name} { opacity: 0; }
      ${frameRules.join('\n')}
      ${startRules.join('\n')}`,
    full: `
      .ac-px-${name} {
        animation: ac-px-fall-${name} var(--ac-pt-t) steps(${options.steps}, end) var(--ac-pt-d) infinite;
      }
      @keyframes ac-px-fall-${name} {
        0%   { translate: 0 0; opacity: 0; }
        6%   { opacity: 1; }
        85%  { opacity: 1; }
        100% {
          translate: ${stepX * options.steps}px ${stepY * options.steps}px;
          opacity: 0;
        }
      }`,
  };
}

/** Sparkle star: left px, top px, cycle s, phase s. */
export type Twinkle = [number, number, number, number];

interface TwinkleOptions {
  /** CSS px per art pixel. */
  scale?: number;
  /** Core, arm and tip colors. */
  tones?: [string, string, string];
}

/** Markup and CSS of a twinkling star layer. */
interface TwinkleStars {
  /** Called at render time. */
  markup: () => JSX.Element[];
  /** Opacity only, so it goes in `always` and Reduce Motion keeps it. */
  css: string;
}

/**
 * Builds stars that pulse from a core pixel to a plus with one-pixel arms and
 * two-pixel tips.
 */
export function twinkleStars(
  points: Twinkle[],
  {scale = 2, tones = ['#fff', '#c9d3ff', '#7f8cc9']}: TwinkleOptions = {},
): TwinkleStars {
  const [core, arm, tip] = tones;
  const plus = (distance: number, color: string): string =>
    `${distance}px 0 ${color}, -${distance}px 0 ${color}, 0 ${distance}px ${color}, 0 -${distance}px ${color}`;
  const placed = points.map(
    ([x, y, cycle, phase], i) => `
      .ac-decoration .ac-px-tw-${i + 1} {
        left: ${x}px;
        top: ${y}px;
        --ac-tw-t: ${cycle}s;
        --ac-tw-d: ${phase}s;
      }`,
  );
  const timing = 'var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite';
  const css = `
      .ac-px-tw {
        width: ${scale}px;
        height: ${scale}px;
        background: ${core};
        animation: ac-px-core ${timing};
      }
      .ac-px-tw::before, .ac-px-tw::after {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: ${scale}px;
        height: ${scale}px;
        opacity: 0;
      }
      .ac-px-tw::before {
        box-shadow: ${plus(scale, arm)};
        animation: ac-px-arms ${timing};
      }
      .ac-px-tw::after {
        box-shadow: ${plus(scale * 2, tip)};
        animation: ac-px-tips ${timing};
      }
      @keyframes ac-px-core {
        0%  { opacity: 0.55; }
        45% { opacity: 1; }
        75% { opacity: 0.8; }
      }
      @keyframes ac-px-arms {
        0%  { opacity: 0; }
        45% { opacity: 1; }
        72% { opacity: 0; }
      }
      @keyframes ac-px-tips {
        0%  { opacity: 0; }
        52% { opacity: 1; }
        62% { opacity: 0; }
      }
      ${placed.join('\n')}`;
  return {
    markup: () =>
      [...points.keys()].map((i) => (
        <span key={i} className={`ac-px-tw ac-px-tw-${i + 1}`} />
      )),
    css,
  };
}
