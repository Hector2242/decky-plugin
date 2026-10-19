/**
 * @fileoverview Halloween: a 16-bit graveyard under a full moon, drawn at 1 CSS
 * px per art pixel, twice the detail of the other pixel skies. Big flat shapes
 * are solid spans clipped to a column outline (columnClip) instead of
 * thousands of box-shadows; detail stays in box-shadows.
 */

import type {JSX} from 'react';

import type {MotionParts} from '../motion';
import type {Theme} from './index';
import {
  type Limb,
  type Twinkle,
  columnClip,
  drawLimbs,
  gridSprite,
  pixel,
  rowsSprite,
  seeded,
  twinkleStars,
} from './pixel_art';

const SCALE = 1;
// CSS px: the decoration area of a toast.
const WIDTH = 288;
// CSS px: the decoration area of a card with a two-line description.
const HEIGHT = 81;
// The compact toast window fits the text 4px higher.
const COMPACT_SHIFT = 4;

const INK = '#0e0c16';
const LIT = '#1c1a2e';
// Moonlight catching the edge of a branch.
const RIM = '#3a3466';
const WHITE = '#f4f2ff';
const LAVENDER = '#b8a5e6';
const MOON_BODY = '#f6edc2';
const MOON_RIM = '#ebddaa';
const CRATER = '#e9bc8c';

// Light text gets a dark halo to read over the moon, ghosts and stones; the
// title and description stop short of the moon, and the % pill (which sits on
// it) gets a backdrop.
const TEXT = `
  .ac-title, .ac-desc, .ac-eyebrow, .ac-progress {
    text-shadow: 0 0 2px ${INK}, 0 0 5px rgb(14 12 22 / 0.95), 0 1px 0 ${INK};
  }
  .ac-decoration-space .ac-title,
  .ac-decoration-space .ac-desc,
  .ac-decoration-space .ac-progress { padding-right: 52px; }
  .ac-toast .ac-pill { padding: 1px 6px; background: rgb(14 12 22 / 0.7); }`;

// Stepped vignette, brightest behind the moon, from the band variables so
// Primary and Secondary recolor it.
const VIGNETTE =
  'radial-gradient(ellipse 90% 150% at 62% 38%, var(--ac-px-b3) 0 45%, var(--ac-px-b2) 45% 70%, var(--ac-px-b1) 70% 90%, var(--ac-px-b0) 90%)';

function dot(x: number, y: number, color: string): string {
  return pixel(x, y, color, SCALE);
}

function art(
  rows: string[],
  palette: Record<string, string>,
  left = 0,
  top = 0,
): string {
  return rowsSprite(rows, palette, {left, top, scale: SCALE}).join(', ');
}

/** Returns the box-shadow list for a map of "x,y" art cells to colors. */
function cellSprite(cells: Map<string, string>): string {
  return [...cells]
    .map(([key, color]) => {
      const [x, y] = key.split(',').map((part) => Number(part));
      return dot(x, y, color);
    })
    .join(', ');
}

// Moon: a rim disc under a body disc, with seeded blotchy craters and a faint
// halo ring.

const MOON_SIZE = 52;
// From the right edge.
const MOON_INSET = 6;
const MOON_CENTRE = (MOON_SIZE - 1) / 2;
const MOON_AT = {x: WIDTH - MOON_INSET - MOON_SIZE, y: 4};
// Sprites are 0px wide, so anchoring one to the right edge puts its left edge
// at the moon's.
const MOON_RIGHT = WIDTH - MOON_AT.x;
const MOON_EDGE = MOON_CENTRE + 0.2;
// The 2px beyond it are rim.
const MOON_BODY_REACH = 23.6;
const CRATER_REACH = 21.5;

/**
 * Returns [top, bottom) of the pixels within `reach` of the moon's centre, per
 * column; columns outside collapse to its middle.
 */
function discColumns(reach: number): Array<[number, number]> {
  const line = [...Array.from({length: MOON_SIZE}).keys()];
  return line.map((x): [number, number] => {
    const inside = line.filter(
      (y) => Math.hypot(x - MOON_CENTRE, y - MOON_CENTRE) <= reach,
    );
    if (inside.length === 0) return [MOON_SIZE / 2, MOON_SIZE / 2];
    return [inside[0], inside[inside.length - 1] + 1];
  });
}

// Each crater grows from a seed by adding random neighbours, so it comes out
// as a rough blob of 10-25 pixels.
function drawCraters(): string {
  const random = seeded(5);
  const within = (x: number, y: number, reach: number): boolean =>
    Math.hypot(x - MOON_CENTRE, y - MOON_CENTRE) <= reach;
  const seeds: Array<[number, number]> = [];
  for (let tries = 0; seeds.length < 8 && tries < 800; tries++) {
    const x = Math.floor(random() * MOON_SIZE);
    const y = Math.floor(random() * MOON_SIZE);
    const apart = seeds.every(([sx, sy]) => Math.hypot(sx - x, sy - y) >= 12);
    if (within(x, y, 18) && apart) seeds.push([x, y]);
  }
  const cells = new Map<string, string>();
  for (const [sx, sy] of seeds) {
    const blob: Array<[number, number]> = [[sx, sy]];
    const size = 10 + Math.floor(random() * 16);
    cells.set(`${sx},${sy}`, CRATER);
    for (let guard = 0; blob.length < size && guard < 400; guard++) {
      const [x, y] = blob[Math.floor(random() * blob.length)];
      const direction = Math.floor(random() * 4);
      const nextX = x + [1, -1, 0, 0][direction];
      const nextY = y + [0, 0, 1, -1][direction];
      const taken = cells.has(`${nextX},${nextY}`);
      if (!within(nextX, nextY, CRATER_REACH) || taken) continue;
      cells.set(`${nextX},${nextY}`, CRATER);
      blob.push([nextX, nextY]);
    }
  }
  return cellSprite(cells);
}

// A ring just outside the disc, 2px thick; it starts at -3 to reach the art
// pixels above and left of the anchor.
const HALO = gridSprite(
  MOON_SIZE + 6,
  (x, y) => {
    const distance = Math.hypot(x - MOON_CENTRE, y - MOON_CENTRE);
    const onRing = distance >= MOON_EDGE + 0.5 && distance <= MOON_EDGE + 2.5;
    return onRing ? MOON_BODY : null;
  },
  {from: -3, scale: SCALE},
);

// Bare tree growing up the left edge, its crown reaching about a third of the
// way across. A flat limb is as thick as it is tall, a steep one as it is
// wide.
const TREE_LIMBS: Limb[] = [
  [1, 41, 2, 22, 5],
  [2, 22, 3, 8, 4],
  [2, 8, 16, 4, 4],
  [16, 4, 30, 5, 3],
  [30, 5, 44, 3, 2],
  [44, 3, 56, 6, 1],
  [56, 6, 64, 4, 1],
  [16, 4, 22, 12, 2],
  [22, 12, 30, 16, 1],
  [30, 5, 34, 11, 1],
  [44, 3, 48, 0, 1],
  [8, 6, 11, 0, 1],
  [24, 4, 27, 0, 1],
  [38, 4, 41, 9, 1],
  [50, 5, 54, 10, 1],
];

function drawTree(): {sprite: string; cells: Set<string>} {
  const cells = new Map<string, string>();
  const put = (x: number, y: number, color: string): void => {
    if (x >= 0 && y >= 0) cells.set(`${x},${y}`, color);
  };
  for (const limb of TREE_LIMBS) {
    const [x0, y0, x1, y1, thickness] = limb;
    // drawLimbs stacks the thickness vertically; a steep limb is drawn with the
    // axes swapped, lit on the moon side.
    if (Math.abs(y1 - y0) > Math.abs(x1 - x0)) {
      const swapped: Limb = [y0, x0, y1, x1, thickness];
      const putSwapped = (y: number, x: number, color: string): void => {
        put(x, y, color);
      };
      drawLimbs([swapped], putSwapped, [INK, INK, RIM]);
    } else {
      drawLimbs([limb], put, [RIM, INK, INK]);
    }
  }
  return {sprite: cellSprite(cells), cells: new Set(cells.keys())};
}
const TREE = drawTree();

// Ghosts: the same 18x16 sprite three times; the middle one sits behind the
// text, one is mirrored.

const GHOST = art(
  [
    '......WWWW........',
    '.....WWWWWWL......',
    '....WWWWWWWL......',
    '....WWEWWEWL......',
    '....WWEWWEWL......',
    '.W..WWWWWWWL......',
    '.WWWWWWWWWLLL.....',
    '..WWWWWWWWLLL.....',
    '...WWWWWWWLL......',
    '...WWWWWWWLL......',
    '...WWWWWWWLL......',
    '...WWWWWWWLLL.....',
    '....WWWWWWLLL.....',
    '.....WWWWWLLLL....',
    '......WWWWWLLLLL..',
    '........WWLLLLLLLL.',
  ],
  {W: WHITE, L: LAVENDER, E: INK},
);
const GHOST_WIDTH = 18;
const GHOST_HEIGHT = 16;

interface Ghost {
  /**
   * Left edge in CSS px; the ones beside the moon are anchored to the right
   * edge like it is.
   */
  x: number;
  y: number;
  anchor: 'left' | 'right';
  /**
   * Keep the same distance from the bottom edge instead of the top, so shorter
   * cards do not cut it off.
   */
  fromBottom?: boolean;
  mirror?: boolean;
  opacity?: number;
  /** Bob period and offset, seconds. */
  bob: [number, number];
}
const GHOSTS: Ghost[] = [
  {x: 140, y: 41, anchor: 'left', opacity: 0.75, bob: [3.4, -0.7]},
  {x: 264, y: 53, anchor: 'right', fromBottom: true, bob: [2.8, -1.9]},
  {x: 204, y: 4, anchor: 'right', mirror: true, bob: [2.4, -1.1]},
];

// Sparkles and stars: seeded, clear of the moon, the tree and the ghosts; half
// of them blink in two alternating groups.

const SPARKLE_AT: Twinkle[] = [
  [92, 3, 3.2, -1.1],
  [134, 6, 2.7, -0.3],
  [172, 3, 3.9, -2.4],
  [220, 46, 3.4, -1.7],
  [60, 4, 2.9, -0.8],
];
const SPARKLES = twinkleStars(SPARKLE_AT, {
  scale: SCALE,
  tones: [WHITE, LAVENDER, '#7d6db3'],
});

function drawStars(): {still: string; blinkA: string; blinkB: string} {
  const random = seeded(11);
  const stars: Array<[number, number, string]> = [];
  const moonX = MOON_AT.x + MOON_CENTRE;
  const moonY = MOON_AT.y + MOON_CENTRE;
  const nearTree = (x: number, y: number): boolean =>
    [-2, -1, 0, 1, 2].some((dx) =>
      [-2, -1, 0, 1, 2].some((dy) => TREE.cells.has(`${x + dx},${y + dy}`)),
    );
  const behindGhost = (x: number, y: number): boolean =>
    GHOSTS.some(
      (ghost) =>
        x >= ghost.x - 1 &&
        x <= ghost.x + GHOST_WIDTH &&
        y >= ghost.y - 1 &&
        y <= ghost.y + GHOST_HEIGHT,
    );
  const nearSparkle = (x: number, y: number): boolean =>
    SPARKLE_AT.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 8);
  for (let tries = 0; stars.length < 40 && tries < 4000; tries++) {
    const x = 2 + Math.floor(random() * (WIDTH - 4));
    const y = 2 + Math.floor(random() * 44);
    const color = random() < 0.65 ? WHITE : LAVENDER;
    if (Math.hypot(x - moonX, y - moonY) < MOON_EDGE + 6) continue;
    if (nearTree(x, y) || behindGhost(x, y) || nearSparkle(x, y)) continue;
    if (stars.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 9)) continue;
    stars.push([x, y, color]);
  }
  // Odd stars stay still; the even ones alternate between two blink groups.
  const still: string[] = [];
  const blinkA: string[] = [];
  const blinkB: string[] = [];
  stars.forEach(([x, y, color], i) => {
    if (i % 2 === 1) {
      still.push(dot(x, y, color));
    } else if (i % 4 === 0) {
      blinkA.push(dot(x, y, color));
    } else {
      blinkB.push(dot(x, y, color));
    }
  });
  return {
    still: still.join(', '),
    blinkA: blinkA.join(', '),
    blinkB: blinkB.join(', '),
  };
}
const STARS = drawStars();

// Bats: two wing frames each, toggled with the shared flap; each crosses the
// sky in 1px steps.

const BAT = {'#': INK};
const BAT_BIG = [
  [
    '.....#.#.....',
    '#...#####...#',
    '##.#######.##',
    '#############',
    '.##.#####.##.',
    '..#..#.#..#..',
  ],
  [
    '.....#.#.....',
    '....#####....',
    '...#######...',
    '.###########.',
    '##.#######.##',
    '#....#.#....#',
  ],
].map((rows) => art(rows, BAT));
const BAT_SMALL = [
  ['..#.#..', '#.###.#', '#######', '.#.#.#.'],
  ['..#.#..', '..###..', '.#####.', '##.#.##'],
].map((rows) => art(rows, BAT));

interface Bat {
  size: 'big' | 'small';
  /** Parked position under Reduce Motion, CSS px. */
  x: number;
  y: number;
  /** Which way it flies; a bat flying right is mirrored. */
  direction: -1 | 1;
  /** Seconds per crossing and offset into it. */
  cross: [number, number];
  /** Wing flap offset, seconds. */
  flap: number;
}
const BATS: Bat[] = [
  {size: 'big', x: 180, y: 12, direction: -1, cross: [14, -3], flap: 0},
  {size: 'big', x: 110, y: 22, direction: 1, cross: [17, -9], flap: -0.15},
  {size: 'big', x: 236, y: 28, direction: -1, cross: [11, -5], flap: -0.3},
  {size: 'small', x: 60, y: 8, direction: 1, cross: [20, -13], flap: -0.05},
];
const BAT_WIDTH = {big: 13, small: 7};
const BAT_HEIGHT = {big: 6, small: 4};

// Grass: 1-5px blades. The ground is one solid span, the lighter blade tips
// are box-shadows.

const GRASS_ROWS = 5;
function drawGrass(): {heights: number[]; tips: string} {
  const random = seeded(41);
  const heights = Array.from(
    {length: WIDTH},
    () => 1 + Math.floor(random() * GRASS_ROWS),
  );
  const tips = heights
    .flatMap((height, x) =>
      height >= 3 ? [dot(x, GRASS_ROWS - height, LIT)] : [],
    )
    .join(', ');
  return {heights, tips};
}
const GRASS = drawGrass();
const GRASS_CLIP = columnClip(
  GRASS.heights.map((height): [number, number] => [
    GRASS_ROWS - height,
    GRASS_ROWS,
  ]),
);

// Skyline: jagged spruces as one solid span clipped to their outline.

const SKYLINE_ROWS = 28;
const TREE_COUNT = 20;

// Trees wrap around the edges, so the repeats shown in wide previews meet
// without a seam.
function drawSkyline(): string {
  const random = seeded(23);
  const top = Array.from({length: WIDTH}, () => SKYLINE_ROWS);
  for (let i = 0; i < TREE_COUNT; i++) {
    const x =
      Math.round(6 + (i * WIDTH) / TREE_COUNT) + Math.floor(random() * 5) - 2;
    const height = 14 + Math.floor(random() * 15);
    for (let row = 0; row < height; row++) {
      const halfWidth = Math.max(
        0,
        Math.floor(row / 2) - (row % 3 === 2 ? 1 : 0),
      );
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const column = (x + dx + WIDTH) % WIDTH;
        top[column] = Math.min(top[column], SKYLINE_ROWS - height + row);
      }
    }
  }
  return columnClip(top.map((t): [number, number] => [t, SKYLINE_ROWS]));
}
const SKYLINE = drawSkyline();

// Tombstones: carved by hand, lit on the left. All bottom-anchored; the grass
// covers their bases.

const STONE = {
  H: '#eee8e4',
  M: '#7e7490',
  S: '#5a4e72',
  D: '#3a2f55',
  K: '#2a2042',
};
// prettier-ignore
const STONES: Record<number, string[]> = {
  1: [
    '.....HHH.....', '....HSSSH....', '...HSSSSSH...', '..HSSSSSSSH..',
    '.HSSSSSSSSSD.', 'HMSSSSSSSSSSD', 'HMSSSSSSSSSSD', 'HMSSSSMSSSSSD',
    'HMSSSKMKSSSSD', 'HMSSMMMMMSSSD', 'HMSSSKMKSSSSD', 'HMSSSSMSSSSSD',
    'HMSSSSMSSSSSD', 'HMSSSSSSSSSSD', 'HMSSSSSSSSSSD', 'HMSSSSSSSSSSD',
    'HMSSSSSSSSSSD',
  ],
  2: [
    '....MH.....', '...MMHH....', '..MMKKHH...', '..MMKKHH...', '...MMHH....',
    '....MH.....', '....MH.....', '....MH.....', '..DSSSSSH..', '.DSSSSSSSH.',
    'DDSSSSSSSSH', 'DDSKKKKKSSH', 'DDSSSSSSSSH', 'DDSKKSSKKSH', 'DDSSSSSSSSH',
    'DDSKKKSKKSH', 'DDSSSSSSSSH', 'DDSSKKKSSSH', 'DDSSSSSSSSH', 'DDSKKSKKSSH',
    'DDSSSSSSSSH',
  ],
  3: [
    '..HHHH..', '.DSSSSD.', 'DSSSSSSD', 'DSSSSSSD', 'DSKKKKSD',
    'DSSSSSSD', 'DSKKKSSD', 'DSSSSSSD', 'DSSSSSSD', 'DSSSSSSD',
  ],
  4: [
    '...SS....', '..SSSS...', '.HSSSSS..', '.HSSSSSD.', 'DSSSKSSSD',
    'DSSSSSSSD', 'DSSKSKSSD', 'DSSKSKSSD', 'DSSKSKSSD', 'DSSSSSSSD',
    'DSSSKSSSD', 'DSSSSSSSD',
  ],
  5: [
    '....HMM....', '....HMM....', '..HHMMMMM..', '..HMMMMMD..', '....HMM....',
    '....HMM....', '....HMM....', '...HMMMMD..', '..HMMMMMMD.', 'HHMMMMMMMMD',
    '.DDDDDDDDD.', '.HSSSSSSSD.', '.HSKKKSSSD.', '.HSSSSSSSD.', '.HSKKKSKKD.',
    '.HSSSSSSSD.', '.HSKKKSKKD.', '.HSSSSSSSD.', '.HSKKKKKSD.', '.HSSSSSSSD.',
    '.HSKKSKSSD.', '.HSSSSSSSD.',
  ],
  6: [
    '....HM....', '....HM....', '..HHHMMM..', '..MMMMMM..', '....HM....',
    '....HM....', 'HHHHHHHHHH', 'HSSSSSSSSD', 'HSKKKKKKSD', 'HSSSSSSSSD',
    'HSKKSKKKSD', 'HSSSSSSSSD', 'HSKKKKKSSD', 'HSSSSSSSSD', 'HSKKSKKKSD',
    'HSSSSSSSSD', 'HSSKKKKSSD', 'HSSSSSSSSD', 'HSSSSSSSSD',
  ],
};
const STONE_ROWS = 22;
const BACK_RAISE = 3;
// x and design: the small rounded stones stand a little further back.
const FRONT_STONES: Array<[number, number]> = [
  [4, 1],
  [50, 5],
  [104, 4],
  [150, 6],
  [244, 2],
];
const BACK_STONES: Array<[number, number]> = [
  [30, 3],
  [80, 3],
  [128, 3],
];

// Cells the grass hides anyway are left out of the sprite.
function stoneSprite(stones: Array<[number, number]>, raise: number): string {
  return stones
    .map(([x, design]) => {
      const rows = STONES[design];
      const visible = rows.map((row, rowIndex) => {
        const depth = rows.length - 1 - rowIndex + raise;
        return [...row]
          .map((cell, column) =>
            GRASS.heights[x + column] > depth ? '.' : cell,
          )
          .join('');
      });
      return art(visible, STONE, x, STONE_ROWS - rows.length);
    })
    .join(', ');
}

// The Quick Access preview is wider than a toast: stars and ground repeat every
// 288px there and stay hidden elsewhere. Solid spans carry only their own
// class; the rest are 0px sprites.
const FILLS = new Set(['skyline', 'grass']);

function repeatedClass(name: string, copy: number): string {
  const sprite = FILLS.has(name) ? '' : 'ac-px-spr ';
  const extra = copy > 0 ? ` ac-px-more ac-px-more-${copy}` : '';
  return `${sprite}ac-px-${name}${extra}`;
}

interface RepeatedProps {
  names: string[];
}

function Repeated({names}: RepeatedProps): JSX.Element {
  return (
    <>
      {[0, 1, 2].flatMap((copy) =>
        names.map((name) => (
          <span key={`${copy}${name}`} className={repeatedClass(name, copy)} />
        )),
      )}
    </>
  );
}

function Layer(): JSX.Element {
  return (
    <>
      {['t', 'b', 'l', 'r'].map((side) => (
        <span key={side} className={`ac-px-edge ac-px-edge-${side}`} />
      ))}
      <Repeated names={['stars', 'stars-a', 'stars-b']} />
      {SPARKLES.markup()}
      <span className="ac-px-spr ac-px-halo" />
      <span className="ac-px-moon-rim" />
      <span className="ac-px-moon-body" />
      <span className="ac-px-spr ac-px-craters" />
      <span className="ac-px-spr ac-px-tree" />
      <Repeated names={['skyline']} />
      {GHOSTS.map(({mirror}, i) => {
        const body = <span className="ac-px-spr ac-px-ghost-art" />;
        return (
          <span key={i} className={`ac-px-ghost ac-px-ghost-${i + 1}`}>
            {mirror ? <span className="ac-px-flip">{body}</span> : body}
          </span>
        );
      })}
      {BATS.map(({size, direction}, i) => {
        const wings = (
          <>
            <span className="ac-px-spr ac-px-bat-a" />
            <span className="ac-px-spr ac-px-bat-b" />
          </>
        );
        return (
          <span
            key={i}
            className={`ac-px-bat ac-px-bat-${i + 1} ac-px-bat-${size}`}
          >
            {direction > 0 ? (
              <span className="ac-px-flip">{wings}</span>
            ) : (
              wings
            )}
          </span>
        );
      })}
      <Repeated names={['stones-back', 'stones', 'grass', 'tips']} />
    </>
  );
}

// Under Reduce Motion the bats stay parked and flap and the stars blink and
// twinkle (opacity only); the ghosts bobbing and the bats crossing are full
// motion.
function css(): MotionParts {
  const ghostAt = GHOSTS.map(({x, y, anchor, fromBottom, opacity}, i) => {
    const side =
      anchor === 'left'
        ? `left: ${x}px`
        : `right: ${WIDTH - x - GHOST_WIDTH}px`;
    const vertical = fromBottom
      ? `bottom: ${HEIGHT - y - GHOST_HEIGHT}px`
      : `top: ${y}px`;
    const fade = opacity ? ` opacity: ${opacity};` : '';
    return `.ac-px-ghost-${i + 1} { ${side}; ${vertical};${fade} }`;
  });
  const batAt = BATS.map(
    ({x, y, flap}, i) =>
      `.ac-px-bat-${i + 1} { left: ${x}px; top: ${y}px; --ac-px-d: ${flap}s; }`,
  );
  const bobs = GHOSTS.map(
    ({bob}, i) => `
      .ac-px-ghost-${i + 1} {
        animation: ac-px-bob ${bob[0]}s steps(1, end) ${bob[1]}s infinite;
      }`,
  );
  // A straight line from just off one edge to just off the other, one step per
  // pixel.
  const crossings = BATS.map(({size, x, direction, cross}, i) => {
    const width = BAT_WIDTH[size];
    const [from, to] =
      direction < 0 ? [WIDTH - x, -width - x] : [-width - x, WIDTH - x];
    return `
      @keyframes ac-px-cross-${i + 1} {
        from { translate: ${from}px 0; }
        to   { translate: ${to}px 0; }
      }
      .ac-px-bat-${i + 1} {
        animation: ac-px-cross-${i + 1} ${cross[0]}s steps(${WIDTH + width}, end) ${cross[1]}s infinite;
      }`;
  });
  const sprites =
    '.ac-px-stars, .ac-px-stars-a, .ac-px-stars-b, .ac-px-tree, ' +
    '.ac-px-skyline, .ac-px-stones-back, .ac-px-stones, .ac-px-grass, ' +
    '.ac-px-tips';
  return {
    always: `
      .ac-px-edge {
        background: repeating-conic-gradient(var(--ac-px-b0) 0 25%, transparent 0 50%) 0 0 / 2px 2px;
      }
      .ac-px-edge-t, .ac-px-edge-b { left: 0; right: 0; height: 4px; }
      .ac-px-edge-l, .ac-px-edge-r { top: 0; bottom: 0; width: 4px; }
      .ac-px-edge-t { top: 0; }
      .ac-px-edge-b { bottom: 0; }
      .ac-px-edge-l { left: 0; }
      .ac-px-edge-r { right: 0; }
      ${sprites} { left: 0; }
      .ac-px-stars, .ac-px-stars-a, .ac-px-stars-b, .ac-px-tree { top: 0; }
      .ac-px-stars { box-shadow: ${STARS.still}; }
      .ac-px-stars-a {
        box-shadow: ${STARS.blinkA};
        animation: ac-px-blink 2.8s steps(1, end) infinite;
      }
      .ac-px-stars-b {
        box-shadow: ${STARS.blinkB};
        animation: ac-px-blink 2.8s steps(1, end) -1.4s infinite;
      }
      .ac-px-more-1 { left: ${WIDTH}px; }
      .ac-px-more-2 { left: ${WIDTH * 2}px; }
      .ac-px-decoration .ac-px-more { display: none; }
      .ac-preview .ac-px-decoration .ac-px-more { display: block; }
      ${SPARKLES.css}
      .ac-px-halo {
        right: ${MOON_RIGHT}px;
        top: ${MOON_AT.y}px;
        box-shadow: ${HALO};
        opacity: 0.3;
      }
      .ac-px-moon-rim, .ac-px-moon-body {
        right: ${MOON_INSET}px;
        top: ${MOON_AT.y}px;
        width: ${MOON_SIZE}px;
        height: ${MOON_SIZE}px;
      }
      .ac-px-moon-rim {
        background: ${MOON_RIM};
        clip-path: ${columnClip(discColumns(MOON_EDGE))};
      }
      .ac-px-moon-body {
        background: ${MOON_BODY};
        clip-path: ${columnClip(discColumns(MOON_BODY_REACH))};
      }
      .ac-px-craters {
        right: ${MOON_RIGHT}px;
        top: ${MOON_AT.y}px;
        box-shadow: ${drawCraters()};
      }
      .ac-px-tree { box-shadow: ${TREE.sprite}; }
      .ac-px-skyline {
        bottom: 0;
        width: ${WIDTH}px;
        height: ${SKYLINE_ROWS}px;
        background: ${INK};
        clip-path: ${SKYLINE};
      }
      .ac-px-ghost { width: ${GHOST_WIDTH}px; height: ${GHOST_HEIGHT}px; }
      ${ghostAt.join('\n')}
      .ac-compact .ac-px-ghost-1 { top: ${GHOSTS[0].y - COMPACT_SHIFT}px; }
      .ac-px-ghost-art { box-shadow: ${GHOST}; }
      .ac-px-flip { scale: -1 1; }
      .ac-px-ghost .ac-px-flip {
        width: ${GHOST_WIDTH}px;
        height: ${GHOST_HEIGHT}px;
      }
      .ac-px-bat-big .ac-px-flip {
        width: ${BAT_WIDTH.big}px;
        height: ${BAT_HEIGHT.big}px;
      }
      .ac-px-bat-small .ac-px-flip {
        width: ${BAT_WIDTH.small}px;
        height: ${BAT_HEIGHT.small}px;
      }
      ${batAt.join('\n')}
      .ac-px-bat-big .ac-px-bat-a { box-shadow: ${BAT_BIG[0]}; }
      .ac-px-bat-big .ac-px-bat-b { box-shadow: ${BAT_BIG[1]}; }
      .ac-px-bat-small .ac-px-bat-a { box-shadow: ${BAT_SMALL[0]}; }
      .ac-px-bat-small .ac-px-bat-b { box-shadow: ${BAT_SMALL[1]}; }
      .ac-px-bat-a {
        animation: ac-px-flap 0.5s steps(1, end) var(--ac-px-d) infinite;
      }
      .ac-px-bat-b {
        animation: ac-px-flap 0.5s steps(1, end) calc(var(--ac-px-d) - 0.25s) infinite;
      }
      .ac-px-stones-back {
        bottom: ${STONE_ROWS + BACK_RAISE}px;
        box-shadow: ${stoneSprite(BACK_STONES, BACK_RAISE)};
      }
      .ac-px-stones {
        bottom: ${STONE_ROWS}px;
        box-shadow: ${stoneSprite(FRONT_STONES, /* raise= */ 0)};
      }
      .ac-compact .ac-px-stones-back, .ac-compact .ac-px-stones {
        translate: 0 ${COMPACT_SHIFT}px;
      }
      .ac-px-grass {
        bottom: 0;
        width: ${WIDTH}px;
        height: ${GRASS_ROWS}px;
        background: ${INK};
        clip-path: ${GRASS_CLIP};
      }
      .ac-px-tips { bottom: ${GRASS_ROWS}px; box-shadow: ${GRASS.tips}; }
      ${TEXT}`,
    full: `
      @keyframes ac-px-bob { 50% { translate: 0 -1px; } }
      ${bobs.join('\n')}
      ${crossings.join('\n')}`,
    reduced: '',
  };
}

/** Halloween graveyard theme. */
export const halloween: Theme = {
  Layer,
  css,
  background: VIGNETTE,
  pixel: 'custom',
};
