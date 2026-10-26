/**
 * @fileoverview Hoth: a 16-bit snowfield where an AT-AT walks the right of the
 * card, firing red lasers at two X-wings that strafe in from the left, shoot
 * back and climb away. Big flat shapes are clipped spans (columnClip); detail
 * is box-shadow pixels at 2 CSS px each.
 */

import type {JSX} from 'react';

import type {MotionParts} from '../motion';
import type {Theme} from './index';
import {
  BANDS,
  FIREBALL_COLORS,
  columnClip,
  discSprite,
  fallingSprites,
  fireballFrames,
  pixel,
  seeded,
} from './pixel_art';

// Art px across the decoration area of a toast (288 CSS px).
const COLUMNS = 144;
const NAVY = '#06285a';
const SNOW = '#e8f2fc';

type Put = (x: number, y: number, color: string) => void;

// Collects art pixels as box-shadows; a later stroke paints over an earlier.
function paint(draw: (put: Put) => void): string {
  const cells = new Map<string, [number, number, string]>();
  draw((x, y, color) => {
    cells.set(`${x} ${y}`, [x, y, color]);
  });
  return [...cells.values()]
    .map(([x, y, color]) => pixel(x, y, color))
    .join(', ');
}

// Copies ASCII art onto `put` with its top left at (left, top).
function stamp(
  put: Put,
  rows: string[],
  palette: Record<string, string>,
  left: number,
  top: number,
): void {
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (palette[char]) put(left + x, top + y, palette[char]);
    });
  });
}

const HULL: Record<string, string> = {
  W: '#ffffff',
  w: '#d5e2ee',
  L: '#9fd6ff',
  N: '#104166',
  M: '#2d445d',
};
const FAR_HULL = {W: '#104166', w: '#0c3557', L: '#22689d', N: '#0c3557'};
// The original's blocky head, facing left: its top rises to the neck, its
// front leans back over a jutting chin, and a light-blue snout ring sits on
// its cheek; slate facets shade the top and front.
const HEAD = [
  '.....MMWWW',
  '...MMWWWWW',
  '..WWWWWWWW',
  '.WLLLWWWLW',
  'MLWWWLWWLW',
  'MLWWWLWWWW',
  '.WLLLWWWWW',
  '.wwwwwwwww',
  '..WWWWWw..',
  '..WNWNW...',
];
// The snout gun under the eye and, a row lower, the chin cannon with its slate
// muzzle block, both pointing forward past the head.
const GUNS = ['..LLL', 'MM', 'MMNNNN', 'MM'];
const HIP = ['.WWWW.', 'WLLLLW', 'WWWWWW', 'WLLLLW', '.WWWW.'];
const LEG = [
  '..WWw...',
  '..WWw...',
  '...WWw..',
  '..WWWWW.',
  '..WLLLW.',
  '..WWWWW.',
  ...Array<string>(3).fill('...WNW..'),
  '...WWW..',
  '..WWWWW.',
  '..wLLLw.',
  '.WWWWWWW',
  'WWWWWWWW',
  'LLLLLLLL',
];
// Like the original: a sloped front block, a tall middle and a sloped rear
// block over a dark belly, the head hung low on a ribbed neck.
const WALKER = paint((put) => {
  for (let x = 16; x <= 41; x++) {
    let top = 0;
    if (x <= 21) top = Math.round(4 - ((x - 16) * 2) / 5);
    else if (x >= 34) top = Math.round(1 + ((x - 34) * 3) / 7);
    else if (x === 22 || x === 33) top = 1;
    for (let y = top; y <= 11; y++) put(x, y, y === 11 ? HULL.w : HULL.W);
  }
  for (let y = 2; y <= 10; y++) {
    put(22, y, HULL.L);
    put(33, y, HULL.L);
  }
  const vents: Array<[number, number]> = [
    [18, 4],
    [19, 4],
    [25, 2],
    [26, 2],
    [30, 3],
    [36, 4],
    [38, 4],
  ];
  vents.forEach(([x, y]) => {
    put(x, y, HULL.L);
  });
  const panel = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) put(x, y, HULL.L);
    }
  };
  panel(18, 6, 20, 8);
  panel(24, 5, 31, 8);
  panel(36, 5, 39, 8);
  for (let x = 28; x <= 31; x++) {
    put(x, 6, HULL.N);
    put(x, 8, HULL.N);
  }
  put(25, 7, HULL.N);
  for (let y = 5; y <= 6; y++) {
    put(38, y, HULL.N);
    put(39, y, HULL.N);
  }
  for (let x = 18; x <= 39; x++) put(x, 12, HULL.N);
  stamp(put, ['WNWNWNWW', 'wNwNwNww'], HULL, 26, 12);
  put(15, 6, HULL.N);
  for (let y = 7; y <= 12; y++) {
    put(14, y, y % 2 ? HULL.N : HULL.L);
    put(15, y, y % 2 ? HULL.L : HULL.N);
  }
  stamp(put, HEAD, HULL, 4, 6);
  stamp(put, GUNS, HULL, 0, 13);
  stamp(put, HIP, HULL, 15, 10);
  stamp(put, HIP, HULL, 35, 10);
});
const LEG_NEAR = paint((put) => {
  stamp(put, LEG, HULL, 0, 0);
});
const LEG_FAR = paint((put) => {
  stamp(put, LEG, FAR_HULL, 0, 0);
});
// One leg lifts at a time, near rear, near front, far rear, far front: each
// leg's column in the walker, stride phase (s) and whether it is on the far
// side. Far legs come first so the near ones cover them.
const LEGS: Array<[number, number, boolean]> = [
  [18, 0, true],
  [32, -0.8, true],
  [15, -1.6, false],
  [35, -2.4, false],
];

// ASCII frames side by side in one SVG, one path per color of merged runs.
// Drawn at half the art size so one-pixel outlines blend instead of vanishing;
// a black underlay (also the outline color) keeps the sky from bleeding
// through between colors.
function svgSheet(frames: string[][], colors: Record<string, string>): string {
  const width = Math.max(...frames.flat().map((row) => row.length));
  const runs = (keep: (char: string) => boolean): string =>
    frames
      .flatMap((rows, f) =>
        rows.flatMap((row, y) => {
          const out: string[] = [];
          for (let x = 0; x < row.length; x++) {
            if (!keep(row[x])) continue;
            const start = x;
            while (x + 1 < row.length && keep(row[x + 1])) x++;
            out.push(
              `M${f * width + start} ${y}h${x - start + 1}v1h-${x - start + 1}z`,
            );
          }
          return out;
        }),
      )
      .join('');
  const paths = Object.entries(colors).map(
    ([char, fill]) => `<path fill="${fill}" d="${runs((c) => c === char)}"/>`,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * frames.length} ${frames[0].length}"><path d="${runs((c) => c !== '.')}"/>${paths.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const SIDE_W = 72;
const SIDE_H = 60;
const MID = 30;
const TURN_FRAMES = 12;
// Share of a pass (%) the dive-in takes to turn side on.
const ARRIVE = 12;
// Side on, the X-wing flies banked toward the viewer so its wings show (the
// first bank, degrees); the doomed one banks harder trying to evade.
const BANKS = [28, 43, 58];

// The X-wing's colors, by the letters its model and shading use.
const XWING_COLORS = {
  W: '#dedad0', // hull facing the light: a weathered off-white
  G: '#8c8c8c', // hull in half shade
  D: '#464646', // hull in shadow
  R: '#e61414', // red markings (nose stripe, wing stripes)
  r: '#960000', // red markings in shadow
  O: '#ff8c28', // engine glow
  B: '#6ea0e6', // astromech dome
  C: '#283c5a', // canopy glass
};

type Vec = [number, number, number];
// A surface sample: position, outward normal, base color and whether it is a
// cannon barrel (kept one pixel thin and never outlined).
type Splat = [Vec, Vec, string, boolean];

// The X-wing in 3D, nose along +x, sampled every half pixel: a boxy fuselage
// tapering to a wedge nose (red side stripe, bubble canopy, astromech dome) and four
// S-foils opened 13 degrees, each with a big engine at its root and a cannon
// (housing, barrel, flash hider) off its tip.
function xwingModel(): Splat[] {
  const out: Splat[] = [];
  const range = (from: number, to: number): number[] =>
    [...Array(Math.round((to - from) / 0.5) + 1).keys()].map(
      (i) => from + i / 2,
    );
  const ring = (radius: number, at: (c: number, s: number) => void): void => {
    const steps = Math.max(8, Math.ceil((2 * Math.PI * radius) / 0.5));
    for (let i = 0; i < steps; i++) {
      at(
        Math.cos((2 * Math.PI * i) / steps),
        Math.sin((2 * Math.PI * i) / steps),
      );
    }
  };
  // Fuselage half height, half width and centre line (the nose tip sits low).
  const body = (x: number): Vec => {
    if (x < -10) return [3.6, 3.2, 0];
    if (x < 4)
      return [3.6 - (0.8 * (x + 10)) / 14, 3.2 - (0.6 * (x + 10)) / 14, 0];
    const t = (x - 4) / 28;
    return [2.8 - 2.1 * t, 2.6 - 2 * t, -0.8 * t];
  };
  for (const x of range(-30, 32)) {
    const [h, w, c] = body(x);
    for (const z of range(-w, w)) {
      out.push([[x, c + h, z], [0, 1, 0], 'W', false]);
      out.push([[x, c - h, z], [0, -1, 0], 'W', false]);
    }
    for (const y of range(-h, h)) {
      // The nose's red marking: a thin stripe along each side, from x 6 to 27.
      // Two units tall (1 CSS px on screen) so it survives every bank angle.
      const color = x > 6 && x < 27 && Math.abs(y) < 1.1 ? 'R' : 'W';
      out.push([[x, c + y, w], [0, 0, 1], color, false]);
      out.push([[x, c + y, -w], [0, 0, -1], color, false]);
    }
  }
  for (const y of range(-3.5, 3.5)) {
    for (const z of range(-3, 3))
      out.push([[-30, y, z], [-1, 0, 0], 'W', false]);
  }
  for (const x of range(-6, 6)) {
    for (const z of range(-2, 2)) {
      const bump = 2.6 * (1 - (x / 6) ** 2) - 0.35 * z * z;
      if (bump <= 0) continue;
      const frame = Math.abs(x - 1) < 0.3 || Math.abs(x + 3) < 0.3;
      out.push([
        [x, body(x)[0] + bump, z],
        [0, 1, 0],
        frame ? 'W' : 'C',
        false,
      ]);
    }
  }
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 12; v++) {
      const tilt = (Math.PI * u) / 14;
      const spin = (Math.PI * v) / 6;
      out.push([
        [
          -11 + 2 * Math.sin(tilt) * Math.cos(spin),
          3.6 + 2 * Math.cos(tilt),
          2 * Math.sin(tilt) * Math.sin(spin),
        ],
        [0, 1, 0],
        u < 3 ? 'B' : 'W',
        false,
      ]);
    }
  }
  for (const degrees of [13, 167, 193, 347]) {
    const dy = Math.sin((degrees * Math.PI) / 180);
    const dz = Math.cos((degrees * Math.PI) / 180);
    for (const x of range(-30, -12)) {
      ring(2.6, (c, s) => {
        out.push([
          [x, dy * 6 + 2.6 * c, dz * 6 + 2.6 * s],
          [0, c, s],
          x > -13.5 ? 'G' : 'W',
          false,
        ]);
      });
    }
    for (const r of range(0, 2)) {
      ring(r, (c, s) => {
        out.push([
          [-30.5, dy * 6 + r * c, dz * 6 + r * s],
          [-1, 0, 0],
          'O',
          false,
        ]);
      });
    }
    for (const r of range(8, 26)) {
      const f = (r - 8) / 18;
      for (const x of range(-28 + 4 * f, -14 - 2 * f)) {
        const red = r > 19 && r < 23 && x < -18;
        out.push([[x, dy * r, dz * r], [0, dz, -dy], red ? 'R' : 'W', false]);
      }
    }
    for (const x of range(-24, 8)) {
      out.push([[x, dy * 26.5, dz * 26.5], [0, 0, 1], 'K', true]);
      const radius = x < -13 ? 0.9 : x > 5 ? 1 : 0;
      if (!radius) continue;
      ring(radius, (c, s) => {
        out.push([
          [x, dy * 26.5 + radius * c, dz * 26.5 + radius * s],
          [0, 0, 1],
          'K',
          true,
        ]);
      });
    }
  }
  return out;
}
// Mostly from the front so the hull facing the viewer stays white.
const LIGHT_LENGTH = Math.hypot(-0.3, 0.55, 0.8);
const LIGHT: Vec = [
  -0.3 / LIGHT_LENGTH,
  0.55 / LIGHT_LENGTH,
  0.8 / LIGHT_LENGTH,
];

// Draws the model rolled, pitched then yawed (radians) with the nearest
// surface winning; faces lit from the front go white, shaded ones grey or
// dark, and everything but the cannons gets a one-pixel outline. Every view,
// from nose-on to side on and every roll, comes from this one model, so moving
// between them is a smooth turn.
function renderXWing(
  model: Splat[],
  yaw: number,
  pitch: number,
  roll: number,
): string[] {
  const turn = ([x0, y0, z0]: Vec): Vec => {
    const y1 = y0 * Math.cos(roll) - z0 * Math.sin(roll);
    const z1 = y0 * Math.sin(roll) + z0 * Math.cos(roll);
    const x2 = x0 * Math.cos(pitch) - y1 * Math.sin(pitch);
    const y2 = x0 * Math.sin(pitch) + y1 * Math.cos(pitch);
    return [
      x2 * Math.cos(yaw) + z1 * Math.sin(yaw),
      y2,
      -x2 * Math.sin(yaw) + z1 * Math.cos(yaw),
    ];
  };
  const depth = Array.from({length: SIDE_H}, () =>
    Array<number>(SIDE_W).fill(-Infinity),
  );
  const grid = Array.from({length: SIDE_H}, () =>
    Array<string>(SIDE_W).fill('.'),
  );
  const thin = Array.from({length: SIDE_H}, () =>
    Array<boolean>(SIDE_W).fill(false),
  );
  for (const [point, normal, base, barrel] of model) {
    const [x, y, z] = turn(point);
    const col = Math.round(SIDE_W / 2 + x);
    const row = Math.round(MID - y);
    if (row < 0 || row >= SIDE_H || col < 0 || col >= SIDE_W) continue;
    if (z <= depth[row][col]) continue;
    depth[row][col] = z;
    const n = turn(normal);
    const light =
      Math.sign(n[2] || 1) *
      (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    let color = base;
    if (base === 'W') color = light > 0 ? 'W' : light > -0.4 ? 'G' : 'D';
    if (base === 'G') color = light > 0.45 ? 'W' : light > -0.2 ? 'G' : 'D';
    if (base === 'R') color = light > -0.2 ? 'R' : 'r';
    grid[row][col] = color;
    thin[row][col] = barrel;
  }
  const solid = (x: number, y: number): boolean =>
    (grid[y]?.[x] ?? '.') !== '.' && !thin[y][x];
  return grid.map((cells, y) =>
    cells
      .map((color, x) =>
        color === '.' &&
        (solid(x + 1, y) ||
          solid(x - 1, y) ||
          solid(x, y + 1) ||
          solid(x, y - 1))
          ? 'K'
          : color,
      )
      .join(''),
  );
}
let sheet: string | undefined;
// The dive-in's turn, from nose-on (banked, nose down) to nearly side on, then
// the side-on banks. Drawn on first use, so only Hoth toasts pay for it.
function xwingSheet(): string {
  if (sheet) return sheet;
  const model = xwingModel();
  sheet = svgSheet(
    [
      ...[...Array(TURN_FRAMES).keys()].map((k) => {
        const away = 1 - k / TURN_FRAMES;
        const radians = Math.PI / 180;
        return renderXWing(
          model,
          -75 * away * radians,
          -18 * away * radians,
          (BANKS[0] + 20 * away) * radians,
        );
      }),
      ...BANKS.map((degrees) =>
        renderXWing(model, 0, 0, (degrees * Math.PI) / 180),
      ),
    ],
    XWING_COLORS,
  );
  return sheet;
}
const frameAt = (percent: number, index: number): string =>
  `${Math.round(percent * 100) / 100}% { translate: ${-index * 36}px 0; }`;
// The turn frames over the first 16% of a pass, quick at first and settling as
// the ship comes side on.
const TURN_IN = [...Array(TURN_FRAMES).keys()]
  .map((k) => frameAt(ARRIVE * (1 - Math.sqrt(1 - k / TURN_FRAMES)), k))
  .join('\n');
const SPARK = paint((put) => {
  stamp(put, ['.Y.', 'YWY', '.Y.'], {Y: '#ffd34d', W: '#fff'}, 0, 0);
});
const BOLT = paint((put) => {
  stamp(put, ['rRWWRr'], {r: '#a80000', R: '#ff2b2b', W: '#ffd6d6'}, 0, 0);
});
// A planted foot slides back 2px every 0.4 s (an eighth of the stride), as the
// ground scrolls, for three quarters of the stride; then it lifts and swings
// forward.
const STRIDE = [1, 2, 3, 4, 5]
  .map((n) => `${n * 12.5}% { translate: ${n * 2 - 6}px 0; }`)
  .join('\n');
// The X-wings' starts (s): both dive in from the distance nose-on and turn
// side on and fire all the way in, cannons alternating; the first climbs away,
// the second banks into the walker's 2.6 s bolt and is shot down.
const XWINGS = [0.3, 0.8];
// The shared pixel fireball, drawn on a 24 grid and shown at 32px.
const BOOM = svgSheet(fireballFrames(), FIREBALL_COLORS);
// How far each X-wing's bolts fly (px) to reach the walker's armor from its
// path.
const REACH = [110, 140];
const percent = (value: number): number => Math.round(value * 100) / 100;
// A cannon firing at each of `times` (% of a pass): the bolt leaves the muzzle,
// flies `reach` px in 0.3 s and is gone.
function volley(name: string, times: number[], reach: number): string {
  const shots = times.map(
    (t) => `
      ${percent(t - 0.01)}% { opacity: 0; translate: 0 0; }
      ${t}% { opacity: 1; translate: 0 0; }
      ${percent(t + 5)}% { opacity: 1; translate: ${reach}px 0; }
      ${percent(t + 5.01)}% { opacity: 0; translate: ${reach}px 0; }`,
  );
  return `@keyframes ${name} {
    0% { opacity: 0; translate: 0 0; }
    ${shots.join('')}
    100% { opacity: 0; translate: ${reach}px 0; }
  }`;
}
// A spark where each of the cannon's bolts lands on the walker.
function sparks(name: string, times: number[]): string {
  const flashes = times.map(
    (t) =>
      `${percent(t + 5)}% { opacity: 1; } ${percent(t + 6.5)}% { opacity: 0; }`,
  );
  return `@keyframes ${name} { 0% { opacity: 0; } ${flashes.join(' ')} }`;
}
// Wreckage: each bit's throw (px) before it tumbles 40px down, and its color.
const DEBRIS: Array<[number, number, string]> = [
  [-12, -8, '#9a9a9a'],
  [10, -10, '#fff'],
  [-6, 6, '#505050'],
  [14, 4, '#e41b1b'],
];

// The original's stars: column, row, bright.
const STARS: Array<[number, number, boolean]> = [
  [7, 11, true],
  [29, 1, true],
  [58, 6, true],
  [86, 1, true],
  [115, 17, true],
  [137, 3, true],
  [14, 4, false],
  [20, 7, false],
  [12, 17, false],
  [36, 11, false],
  [26, 21, false],
  [72, 11, false],
  [86, 6, false],
  [101, 11, false],
  [130, 6, false],
  [122, 11, false],
];
const starsOf = (bright: boolean): string =>
  STARS.filter((star) => star[2] === bright)
    .map(([x, y]) => pixel(x, y, bright ? '#fff' : 'rgb(255 255 255 / 0.5)'))
    .join(', ');

// Lit at the top left and fading toward the bottom right, like the original.
const MOON = discSprite(10, {
  body: 'rgb(255 255 255 / 0.55)',
  rim: 'rgb(255 255 255 / 0.3)',
  rimFrom: 3.8,
  highlight: (x, y) => x + y < 9,
  highlightColor: '#fff',
});

interface Slope {
  height: number;
  summit: number;
  lit: boolean;
}

// A jagged range: each column takes its tallest peak at 45 degrees, nudged a
// pixel up or down by a seeded wobble; west faces catch the light.
function range(peaks: Array<[number, number]>, seed: number): Slope[] {
  const random = seeded(seed);
  let wobble = 0;
  return [...Array(COLUMNS).keys()].map((x) => {
    wobble = Math.max(-1, Math.min(1, wobble + Math.round(random() * 2 - 1)));
    const [peak, summit] = peaks.reduce((best, next) =>
      next[1] - Math.abs(x - next[0]) > best[1] - Math.abs(x - best[0])
        ? next
        : best,
    );
    const height = summit - Math.abs(x - peak) + (x === peak ? 0 : wobble);
    return {height: Math.max(0, height), summit, lit: x < peak};
  });
}

interface RangeStyle {
  shade: string;
  lit: string;
  cap: string;
  capShade: string;
  rock?: string;
}

// A range sitting behind the snow: shaded body, lit faces, snow caps reaching
// four rows below each summit and, if given, rock streaks on shaded faces.
function rangeCss(name: string, slopes: Slope[], style: RangeStyle): string {
  const rows = Math.max(...slopes.map(({height}) => height));
  const clip = (litOnly: boolean): string =>
    columnClip(
      slopes.flatMap(({height, lit}): Array<[number, number]> => {
        const top = litOnly && !lit ? rows * 2 : (rows - height) * 2;
        return [
          [top, rows * 2],
          [top, rows * 2],
        ];
      }),
    );
  const details = paint((put) => {
    slopes.forEach(({height, summit, lit}, x) => {
      const top = rows - height;
      const cap = Math.min(height, 4 - (summit - height));
      for (let row = 0; row < cap; row++) {
        put(x, top + row, lit ? style.cap : style.capShade);
      }
      if (style.rock && !lit && height > cap + 2 && x % 3 === 0) {
        put(x, top + Math.max(cap, 0) + 1, style.rock);
        put(x, top + Math.max(cap, 0) + 2, style.rock);
      }
    });
  });
  return `
    .ac-px-${name}, .ac-px-${name}-lit {
      left: 0;
      bottom: 6px;
      width: ${COLUMNS * 2}px;
      height: ${rows * 2}px;
      background: ${style.shade};
      clip-path: ${clip(false)};
    }
    .ac-px-${name}-lit { background: ${style.lit}; clip-path: ${clip(true)}; }
    .ac-px-${name}-caps {
      left: 0;
      bottom: ${6 + rows * 2}px;
      box-shadow: ${details};
    }`;
}
const RANGES = [
  rangeCss(
    'far',
    range(
      [
        [22, 14],
        [58, 11],
        [88, 15],
        [124, 12],
      ],
      5,
    ),
    {shade: '#3a90d8', lit: '#55a5e6', cap: '#d9ecff', capShade: '#a9cdee'},
  ),
  rangeCss(
    'near',
    range(
      [
        [6, 10],
        [40, 8],
        [70, 11],
        [104, 9],
        [140, 12],
      ],
      9,
    ),
    {
      shade: '#4cb3ff',
      lit: '#8fd0ff',
      cap: '#f4f9ff',
      capShade: '#cfe6ff',
      rock: '#2f86d0',
    },
  ),
];

// The ground scrolls under the walker at its planted feet's speed, so the
// snow profile repeats every 144 columns and is drawn three times over.
const GROUND = COLUMNS * 3;
const depthAt = (x: number): number =>
  Math.max(
    3,
    4 +
      Math.round(
        Math.sin((x * Math.PI) / 18) + 0.6 * Math.sin((x * Math.PI) / 8 + 1),
      ),
  );
const SNOW_ROWS = Math.max(...[...Array(COLUMNS).keys()].map(depthAt));
function snowClip(band: number): string {
  return columnClip(
    [...Array(GROUND).keys()].flatMap((x): Array<[number, number]> => {
      const top = (SNOW_ROWS - depthAt(x)) * 2;
      const bottom = band ? top + band : SNOW_ROWS * 2;
      return [
        [top, bottom],
        [top, bottom],
      ];
    }),
  );
}
// Shade on the lee of each drift, speckled texture and two rocks poking
// through, per period.
const SNOW_DETAIL = paint((put) => {
  for (let x = 0; x < GROUND; x++) {
    const local = x % COLUMNS;
    const top = SNOW_ROWS - depthAt(x);
    if (depthAt(x + 1) < depthAt(x)) put(x, top + 1, '#c7dcf2');
    for (let y = top + 2; y < SNOW_ROWS; y++) {
      if ((local * 3 + y * 5) % 11 === 0) put(x, y, '#d6e7f8');
    }
    if (local === 30 || local === 78) {
      stamp(put, ['.rR', 'rRR'], {r: '#8ca7c2', R: '#5d7894'}, x, top + 1);
    }
  }
});
const GLINTS = [...Array(GROUND).keys()]
  .filter((x) => [12, 47, 63, 90, 120].includes(x % COLUMNS))
  .map((x) => pixel(x, SNOW_ROWS - depthAt(x) + 1, '#a8e4ff'))
  .join(', ');

const SNOWFALL = fallingSprites({
  name: 'flake',
  count: 16,
  seed: 3,
  frames: [['W'], ['w']],
  palettes: [{W: '#fff', w: '#dcefff'}],
  area: {x: [20, 280], y: [-4, 44]},
  cycle: [5, 8],
  vector: [-2, 2],
  steps: 24,
});

// White text gets a navy halo over the snow, mountains and walker; the title
// and description stop short of the walker, and the % pill (which sits on it)
// gets a backdrop.
const TEXT = `
  .ac-title, .ac-desc, .ac-eyebrow, .ac-progress {
    text-shadow: 0 0 2px ${NAVY}, 0 1px 0 ${NAVY};
  }
  .ac-decoration-space .ac-title,
  .ac-decoration-space .ac-desc,
  .ac-decoration-space .ac-progress { padding-right: 84px; }
  .ac-toast .ac-pill { padding: 1px 6px; background: rgb(6 40 90 / 0.75); }`;

function Layer(): JSX.Element {
  return (
    <>
      <span className="ac-px-spr ac-px-stars" />
      <span className="ac-px-spr ac-px-twinkle" />
      <span className="ac-px-spr ac-px-moon" />
      {['far', 'near'].flatMap((name) => [
        <span key={name} className={`ac-px-${name}`} />,
        <span key={`${name}-lit`} className={`ac-px-${name}-lit`} />,
        <span
          key={`${name}-caps`}
          className={`ac-px-spr ac-px-${name}-caps`}
        />,
      ])}
      <span className="ac-px-ground">
        <span className="ac-px-snow" />
        <span className="ac-px-crest" />
        <span className="ac-px-spr ac-px-snow-detail" />
        <span className="ac-px-spr ac-px-glints" />
      </span>
      <span className="ac-px-atat">
        {LEGS.map(([, , far], i) => (
          <span
            key={i}
            className={`ac-px-spr ac-px-leg ac-px-leg-${i + 1} ac-px-leg-${far ? 'far' : 'near'}`}
          />
        ))}
        <span className="ac-px-spr ac-px-atat-body" />
        <span className="ac-px-spr ac-px-bolt ac-px-bolt-1" />
        <span className="ac-px-spr ac-px-bolt ac-px-bolt-2" />
      </span>
      {XWINGS.map((start, i) => (
        <span key={start} className={`ac-px-xw ac-px-xw-${i + 1}`}>
          <span className="ac-px-weave">
            <span className="ac-px-xw-side">
              <span className="ac-px-xw-strip" />
            </span>
            <span className="ac-px-spr ac-px-xw-shot ac-px-xw-shot-a" />
            <span className="ac-px-spr ac-px-xw-shot ac-px-xw-shot-b" />
            <span className="ac-px-spr ac-px-xw-hit" />
            <span className="ac-px-boom">
              <span className="ac-px-boom-strip" />
            </span>
            {[...DEBRIS.keys()].map((n) => (
              <span
                key={n}
                className={`ac-px-spr ac-px-debris ac-px-debris-${n + 1}`}
              />
            ))}
          </span>
        </span>
      ))}
      {SNOWFALL.markup()}
    </>
  );
}

// Under Reduce Motion the walker stands still, the ships and bolts stay hidden
// and only the stars and glints blink. The walker's stride and bob hold each
// pose in whole pixels; the X-wings fly smoothly.
function css(): MotionParts {
  const legs = LEGS.map(
    ([x, phase], i) =>
      `.ac-px-leg-${i + 1} { left: ${x * 2}px; --ac-px-d: ${phase}s; }`,
  );
  const [first, second] = XWINGS;
  const flights = `
      .ac-px-xw-1 { animation: ac-px-x1 6s ${first}s infinite; }
      .ac-px-xw-1 .ac-px-weave { animation: ac-px-y1 6s ${first}s infinite; }
      .ac-px-xw-1 .ac-px-xw-side { animation: ac-px-side1 6s ${first}s infinite; }
      .ac-px-xw-1 .ac-px-xw-strip { animation: ac-px-pose1 6s steps(1, end) ${first}s infinite; }
      .ac-px-xw-1 .ac-px-xw-shot-a { animation: ac-px-volley1a 6s linear ${first}s infinite; }
      .ac-px-xw-1 .ac-px-xw-shot-b { animation: ac-px-volley1b 6s linear ${first}s infinite; }
      .ac-px-xw-1 .ac-px-xw-hit { animation: ac-px-sparks1 6s steps(1, end) ${first}s infinite; }
      .ac-px-xw-2 .ac-px-xw-shot-a { animation: ac-px-volley2a 6s linear ${second}s infinite; }
      .ac-px-xw-2 .ac-px-xw-shot-b { animation: ac-px-volley2b 6s linear ${second}s infinite; }
      .ac-px-xw-2 .ac-px-xw-hit { animation: ac-px-sparks2 6s steps(1, end) ${second}s infinite; }
      .ac-px-xw-2 { animation: ac-px-x2 6s ${second}s infinite; }
      .ac-px-xw-2 .ac-px-weave { animation: ac-px-y2 6s ${second}s infinite; }
      .ac-px-xw-2 .ac-px-xw-side { animation: ac-px-side2 6s ${second}s infinite; }
      .ac-px-xw-2 .ac-px-xw-strip { animation: ac-px-pose2 6s steps(1, end) ${second}s infinite; }
      .ac-px-xw-2 .ac-px-boom { animation: ac-px-boom-life 6s steps(1, end) ${second}s infinite; }
      .ac-px-xw-2 .ac-px-boom-strip { animation: ac-px-boom 6s steps(1, end) ${second}s infinite; }
      ${DEBRIS.map(
        ([dx, dy], n) => `
      .ac-px-xw-2 .ac-px-debris-${n + 1} { animation: ac-px-debris-${n + 1} 6s ${second}s infinite; }
      @keyframes ac-px-debris-${n + 1} {
        0%, 31.5% { opacity: 0; translate: 0 0; }
        31.6% { opacity: 1; translate: 0 0; animation-timing-function: ease-out; }
        36% { translate: ${dx}px ${dy}px; animation-timing-function: ease-in; }
        45% { opacity: 1; translate: ${Math.round(dx * 1.4)}px ${dy + 40}px; }
        45.1%, 100% { opacity: 0; translate: ${Math.round(dx * 1.4)}px ${dy + 40}px; }
      }`,
      ).join('')}`;
  return {
    always: `
      .ac-px-stars, .ac-px-twinkle { left: 0; top: 0; }
      .ac-px-stars { box-shadow: ${starsOf(false)}; }
      .ac-px-twinkle {
        box-shadow: ${starsOf(true)};
        animation: ac-px-blink 3.2s steps(1, end) infinite;
      }
      .ac-px-moon { right: 66px; top: 2px; box-shadow: ${MOON}; }
      ${RANGES.join('\n')}
      .ac-px-ground {
        left: -${COLUMNS * 2}px;
        bottom: 0;
        width: ${GROUND * 2}px;
        height: ${SNOW_ROWS * 2}px;
      }
      .ac-px-snow, .ac-px-crest { left: 0; top: 0; width: 100%; height: 100%; }
      .ac-px-snow { background: ${SNOW}; clip-path: ${snowClip(0)}; }
      .ac-px-crest { background: #fff; clip-path: ${snowClip(2)}; }
      .ac-px-snow-detail, .ac-px-glints { left: 0; top: 0; }
      .ac-px-snow-detail { box-shadow: ${SNOW_DETAIL}; }
      .ac-px-glints {
        box-shadow: ${GLINTS};
        animation: ac-px-blink 2.2s steps(1, end) infinite;
      }
      .ac-px-atat { right: 6px; bottom: 4px; width: 84px; height: 58px; }
      .ac-px-atat-body { left: 0; top: 0; box-shadow: ${WALKER}; }
      .ac-px-leg { top: 28px; }
      ${legs.join('\n')}
      .ac-px-leg-near { box-shadow: ${LEG_NEAR}; }
      .ac-px-leg-far { box-shadow: ${LEG_FAR}; }
      .ac-px-bolt, .ac-px-xw, .ac-px-xw-shot { opacity: 0; }
      .ac-px-bolt { left: -12px; top: 30px; box-shadow: ${BOLT}; }
      .ac-px-bolt-2 { left: -8px; top: 26px; }
      .ac-px-xw { left: -36px; }
      .ac-px-xw-1 { top: 8px; }
      .ac-px-xw-2 { top: 34px; }
      .ac-px-weave, .ac-px-xw-side, .ac-px-xw-strip { left: 0; top: 0; }
      .ac-px-xw-side { width: 36px; height: 30px; overflow: hidden; }
      .ac-px-xw-strip {
        width: ${36 * (TURN_FRAMES + BANKS.length)}px;
        height: 30px;
        background: ${xwingSheet()} 0 0 / 100% 100% no-repeat;
      }
      .ac-px-xw-shot { left: 22px; top: 5px; box-shadow: ${BOLT}; }
      .ac-px-xw-shot-b { top: 23px; }
      .ac-px-xw-hit { left: ${22 + REACH[0]}px; top: 21px; box-shadow: ${SPARK}; opacity: 0; }
      .ac-px-xw-2 .ac-px-xw-hit { left: ${22 + REACH[1]}px; }
      .ac-px-xw-side, .ac-px-boom, .ac-px-debris { opacity: 0; }
      .ac-px-boom { left: 2px; top: -1px; width: 32px; height: 32px; overflow: hidden; }
      .ac-px-boom-strip {
        left: 0;
        top: 0;
        width: 192px;
        height: 32px;
        background: ${BOOM} 0 0 / 100% 100% no-repeat;
      }
      .ac-px-debris { left: 18px; top: 15px; }
      ${DEBRIS.map(
        ([, , color], n) =>
          `.ac-px-debris-${n + 1} { box-shadow: ${pixel(0, 0, color)}, ${pixel(1, 0, color)}; }`,
      ).join('\n')}
      ${SNOWFALL.always}
      ${TEXT}`,
    full: `
      .ac-px-leg { animation: ac-px-stride 3.2s steps(1, end) var(--ac-px-d) infinite; }
      .ac-px-atat-body { animation: ac-px-sway 0.8s steps(1, end) infinite; }
      .ac-px-ground { animation: ac-px-scroll 57.6s steps(144, end) infinite; }
      .ac-px-bolt { animation: ac-px-bolt 2s 0.6s infinite; }
      .ac-px-bolt-2 { animation-delay: 0.85s; }
      ${flights}
      @keyframes ac-px-stride {
        0%, 100% { translate: -6px 0; }
        ${STRIDE}
        75% { translate: 6px 0; }
        81.25% { translate: 2px -4px; }
        87.5% { translate: -2px -6px; }
        93.75% { translate: -6px -4px; }
      }
      @keyframes ac-px-scroll { to { translate: ${COLUMNS * 2}px 0; } }
      @keyframes ac-px-sway { 50% { translate: 0 2px; } }
      @keyframes ac-px-bolt {
        0% { opacity: 1; translate: 0 0; animation-timing-function: steps(60, end); }
        24% { opacity: 1; translate: -240px 0; }
        24.1%, 100% { opacity: 0; translate: -240px 0; }
      }
      @keyframes ac-px-x1 {
        0% { opacity: 1; translate: 60px 0; animation-timing-function: ease-out; }
        ${ARRIVE}% { translate: 100px 0; animation-timing-function: linear; }
        46% {
          translate: 170px 0;
          animation-timing-function: cubic-bezier(0.3, 0.09, 0.7, 0.6);
        }
        61% { opacity: 1; }
        64%, 100% { opacity: 0; translate: 300px 0; }
      }
      @keyframes ac-px-y1 {
        0% { translate: 0 -16px; animation-timing-function: ease-out; }
        ${ARRIVE}% { translate: 0 0; animation-timing-function: ease-in-out; }
        26% { translate: 0 -3px; animation-timing-function: ease-in-out; }
        36% { translate: 0 3px; animation-timing-function: ease-in-out; }
        46% {
          translate: 0 0;
          animation-timing-function: cubic-bezier(0.45, 0, 0.8, 0.6);
        }
        64%, 100% { translate: 0 -90px; }
      }
      @keyframes ac-px-x2 {
        0% { opacity: 1; translate: 30px 0; animation-timing-function: ease-out; }
        ${ARRIVE}% { translate: 70px 0; animation-timing-function: linear; }
        31.5% { translate: 104px 0; }
        45% { opacity: 1; translate: 104px 0; }
        45.1%, 100% { opacity: 0; translate: 104px 0; }
      }
      @keyframes ac-px-y2 {
        0% { translate: 0 -16px; animation-timing-function: ease-out; }
        ${ARRIVE}% { translate: 0 0; animation-timing-function: ease-in-out; }
        24% { translate: 0 -3px; animation-timing-function: ease-in-out; }
        31.5%, 100% { translate: 0 0; }
      }
      @keyframes ac-px-side1 {
        0% { opacity: 0; scale: 0.3; rotate: 0deg; animation-timing-function: ease-out; }
        2% { opacity: 1; }
        ${ARRIVE}% { opacity: 1; scale: 1; }
        46% { rotate: 0deg; animation-timing-function: ease-in-out; }
        50% { scale: 1; animation-timing-function: ease-in; }
        55% { rotate: -22deg; animation-timing-function: ease-out; }
        64% { opacity: 1; scale: 0.75; rotate: -32deg; }
        64.1%, 100% { opacity: 0; scale: 0.75; rotate: -32deg; }
      }
      @keyframes ac-px-side2 {
        0% { opacity: 0; scale: 0.3; animation-timing-function: ease-out; }
        2% { opacity: 1; }
        ${ARRIVE}% { opacity: 1; scale: 1; }
        31.4% { opacity: 1; scale: 1; }
        31.5%, 100% { opacity: 0; scale: 1; }
      }
      @keyframes ac-px-pose1 {
        ${TURN_IN}
        ${frameAt(ARRIVE, TURN_FRAMES)}
        ${frameAt(100, TURN_FRAMES)}
      }
      @keyframes ac-px-pose2 {
        ${TURN_IN}
        ${frameAt(ARRIVE, TURN_FRAMES)}
        ${frameAt(27, TURN_FRAMES + 1)}
        ${frameAt(29, TURN_FRAMES + 2)}
        ${frameAt(100, TURN_FRAMES + 2)}
      }
      @keyframes ac-px-boom-life {
        0% { opacity: 0; }
        31.5% { opacity: 1; }
        39.5%, 100% { opacity: 0; }
      }
      @keyframes ac-px-boom {
        0% { translate: 0 0; }
        ${[1, 2, 3, 4, 5]
          .map(
            (k) =>
              `${Math.round((31.5 + k * 1.3) * 10) / 10}% { translate: ${-k * 32}px 0; }`,
          )
          .join('\n')}
        100% { translate: -160px 0; }
      }
      ${volley('ac-px-volley1a', [14, 22, 30, 38], REACH[0])}
      ${volley('ac-px-volley1b', [18, 26, 34, 42], REACH[0])}
      ${sparks('ac-px-sparks1', [18, 26, 34, 42])}
      ${volley('ac-px-volley2a', [14, 22, 30], REACH[1])}
      ${volley('ac-px-volley2b', [18, 26], REACH[1])}
      ${sparks('ac-px-sparks2', [18, 26])}
      ${SNOWFALL.full}`,
    reduced: '',
  };
}

/** Star Wars Hoth theme. */
export const hoth: Theme = {
  Layer,
  css,
  background: BANDS,
  pixel: 'banded',
};
