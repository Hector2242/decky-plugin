import type { JSX } from "react";

// Each art pixel is a px x px box-shadow (offset to its centre, half the size as spread) of a 0x0 element, so a
// sprite paints once and only ever moves on the compositor. Scenes draw at 2 CSS px per art pixel; Halloween at 1.
export function pixel(x: number, y: number, color: string, px = 2): string {
  return `${x * px + px / 2}px ${y * px + px / 2}px 0 ${px / 2}px ${color}`;
}

export function rowsSprite(rows: string[], palette: Record<string, string>, dx = 0, dy = 0, px = 2): string[] {
  const out: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color) out.push(pixel(x + dx, y + dy, color, px));
    }
  });
  return out;
}

/** A size x size block of art pixels; `from` below 0 reaches past the sprite's anchor. */
export function gridSprite(size: number, colorAt: (x: number, y: number) => string | null, from = 0, px = 2): string {
  const out: string[] = [];
  for (let y = from; y < from + size; y++) {
    for (let x = from; x < from + size; x++) {
      const color = colorAt(x, y);
      if (color) out.push(pixel(x, y, color, px));
    }
  }
  return out.join(", ");
}

/**
 * clip-path for a flat shape given as a [top, bottom) span per 1px column. Every edge sits on whole pixels,
 * so a solid span clipped with it paints as crisp as the same shape in box-shadows, at a fraction of the CSS.
 */
export function columnClip(cols: [number, number][]): string {
  const at = (n: number): string => (n === 0 ? "0" : `${n}px`);
  const top: string[] = [];
  const bottom: string[] = [];
  const runs = (side: 0 | 1, out: string[], reverse: boolean): void => {
    const edges: [number, number, number][] = [];
    for (let x = 0; x < cols.length; x++) {
      const last = edges[edges.length - 1];
      if (last && last[2] === cols[x][side]) last[1] = x + 1;
      else edges.push([x, x + 1, cols[x][side]]);
    }
    for (const [x0, x1, y] of reverse ? edges.reverse() : edges) {
      out.push(...(reverse ? [x1, x0] : [x0, x1]).map((x) => `${at(x)} ${at(y)}`));
    }
  };
  runs(0, top, false);
  runs(1, bottom, true);
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

interface DiscOptions {
  body: string;
  rim: string;
  /** Distance from the centre, in art px, where the rim begins. */
  rimFrom: number;
  highlight?: (x: number, y: number) => boolean;
  highlightColor?: string;
  /** Spots win over the rim. */
  spots?: [number, number][];
  spotColor?: string;
}

/** A round sprite centred on a size x size grid, its edge 0.2 art px beyond the outermost pixel centres. */
export function discSprite(size: number, o: DiscOptions): string {
  const centre = (size - 1) / 2;
  return gridSprite(size, (x, y) => {
    const d = Math.hypot(x - centre, y - centre);
    if (d > centre + 0.2) return null;
    if (o.spotColor && o.spots?.some(([sx, sy]) => sx === x && sy === y)) return o.spotColor;
    if (d > o.rimFrom) return o.rim;
    return o.highlightColor && o.highlight?.(x, y) ? o.highlightColor : o.body;
  });
}

/** x0, y0, x1, y1, thickness, in art px. */
export type Limb = [number, number, number, number, number];

/** Rasterizes straight limbs into `put`, shading each one lit top, middle, underside (a single row uses the middle). */
export function drawLimbs(limbs: Limb[], put: (x: number, y: number, color: string) => void, shades: [string, string, string]): void {
  for (const [x0, y0, x1, y1, w] of limbs) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps - w / 2);
      for (let k = 0; k < w; k++) put(x, y + k, w === 1 ? shades[1] : shades[k === 0 ? 0 : k === w - 1 ? 2 : 1]);
    }
  }
}

// Drifting layers hold three copies 146 art px (292 CSS px) apart, so translating by -292px loops
// seamlessly on toasts and QAM previews up to 584px wide.
export function looped(build: (dx: number) => string[]): string {
  return [...build(0), ...build(146), ...build(292)].join(", ");
}

// Seeded (mulberry32) so every toast draws exactly the same branches, petals and leaves.
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

// Pixel skies are four 20px bands like a 16-bit gradient, from --ac-px-b0 (Secondary) at the top to
// --ac-px-b3 (Primary). Without color-mix() (older Steam clients) the middle bands snap to the nearer end.
const COLOR_MIX = typeof CSS === "undefined" || CSS.supports("color", "color-mix(in srgb, red 50%, blue)");
const BAND_1 = COLOR_MIX ? "color-mix(in srgb, var(--ac-primary) 33%, var(--ac-secondary))" : "var(--ac-secondary)";
const BAND_2 = COLOR_MIX ? "color-mix(in srgb, var(--ac-primary) 67%, var(--ac-secondary))" : "var(--ac-primary)";

export const BANDS =
  "linear-gradient(180deg, var(--ac-px-b0) 0 20px, var(--ac-px-b1) 20px 40px, var(--ac-px-b2) 40px 60px, var(--ac-px-b3) 60px)";

// 2px checkerboard strips over each band edge.
export const DITHER = [0, 1, 2]
  .map((i) => `.ac-px-decoration .ac-px-d${i + 1} { top: ${18 + i * 20}px; background: repeating-conic-gradient(var(--ac-px-b${i}) 0 25%, var(--ac-px-b${i + 1}) 0 50%) 0 0 / 4px 4px; }`)
  .join("\n");

export const PIXEL_BASE = `
  .ac-toast { --ac-px-b0: var(--ac-secondary); --ac-px-b1: ${BAND_1}; --ac-px-b2: ${BAND_2}; --ac-px-b3: var(--ac-primary); }
  .ac-px-decoration span { position: absolute; display: block; }
  .ac-px-dither { left: 0; right: 0; height: 4px; }
  .ac-px-spr { width: 0; height: 0; }
  @keyframes ac-px-flap { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes ac-px-blink { 0% { opacity: 1; } 30% { opacity: 0.35; } 45% { opacity: 1; } 70% { opacity: 0.5; } 85% { opacity: 1; } }
  @keyframes ac-px-drift { to { translate: -292px 0; } }`;

export interface FallingOptions {
  /** Class prefix: sprites are .ac-px-{name}, numbered .ac-px-{name}-1 and up. */
  name: string;
  count: number;
  seed: number;
  /** Two ASCII frames the sprite flutters between. */
  frames: [string[], string[]];
  /** Letter to color maps, cycled per sprite. */
  palettes: Record<string, string>[];
  /** Where sprites start, in CSS px (even values). */
  area: { x: [number, number]; y: [number, number] };
  /** Seconds per fall. */
  cycle: [number, number];
  /** Travel per step in CSS px (multiples of 2). */
  vector: [number, number];
  steps: number;
}

/**
 * Sprites that flutter while falling in hard steps. `always` hides them and holds the flutter,
 * `full` holds the fall, so under Reduce Motion they stay invisible. `markup()` is called at render time.
 */
export function fallingSprites(o: FallingOptions): { markup: () => JSX.Element[]; always: string; full: string } {
  const rand = seeded(o.seed);
  const [x0, x1] = o.area.x;
  const [y0, y1] = o.area.y;
  const each = Array.from({ length: o.count }, () => {
    const cycle = Math.round((o.cycle[0] + rand() * (o.cycle[1] - o.cycle[0])) * 10) / 10;
    return {
      cycle,
      x: Math.round(rand() * ((x1 - x0) / 2)) * 2 + x0,
      y: Math.round(rand() * ((y1 - y0) / 2)) * 2 + y0,
      delay: -Math.round(rand() * cycle * 10) / 10,
    };
  });

  const n = o.name;
  const frames = o.palettes.map((palette, p) => {
    const [a, b] = o.frames.map((rows) => rowsSprite(rows, palette).join(", "));
    return `.ac-px-${n}-a${p} { box-shadow: ${a}; animation: ac-px-flap 0.6s steps(1, end) infinite; }
      .ac-px-${n}-b${p} { box-shadow: ${b}; animation: ac-px-flap 0.6s steps(1, end) -0.3s infinite; }`;
  });
  const starts = each.map(
    (s, i) => `.ac-decoration .ac-px-${n}-${i + 1} { left: ${s.x}px; top: ${s.y}px; --ac-pt-t: ${s.cycle}s; --ac-pt-d: ${s.delay}s; }`,
  );
  const [vx, vy] = o.vector;

  return {
    markup: () => each.map((_, i) => {
      const p = i % o.palettes.length;
      return (
        <span key={i} className={`ac-px-${n} ac-px-${n}-${i + 1}`}>
          <span className={`ac-px-spr ac-px-${n}-a${p}`} />
          <span className={`ac-px-spr ac-px-${n}-b${p}`} />
        </span>
      );
    }),
    always: `.ac-px-${n} { opacity: 0; }
      ${frames.join("\n")}
      ${starts.join("\n")}`,
    full: `.ac-px-${n} { animation: ac-px-fall-${n} var(--ac-pt-t) steps(${o.steps}, end) var(--ac-pt-d) infinite; }
      @keyframes ac-px-fall-${n} {
        0% { translate: 0 0; opacity: 0; }
        6% { opacity: 1; }
        85% { opacity: 1; }
        100% { translate: ${vx * o.steps}px ${vy * o.steps}px; opacity: 0; }
      }`,
  };
}

/** Sparkle stars: left px, top px, cycle s, phase s. */
export type Twinkle = [number, number, number, number];

/**
 * Stars that pulse from a core pixel to a plus with one-pixel arms and two-pixel tips. `css` goes in `always`
 * (opacity only, so Reduce Motion keeps it); `markup()` is called at render time. `px` is the art pixel size.
 */
export function twinkleStars(
  points: Twinkle[],
  px = 2,
  tones: [string, string, string] = ["#fff", "#c9d3ff", "#7f8cc9"],
): { markup: () => JSX.Element[]; css: string } {
  const [core, arm, tip] = tones;
  const plus = (n: number, color: string): string => `${n}px 0 ${color}, -${n}px 0 ${color}, 0 ${n}px ${color}, 0 -${n}px ${color}`;
  const placed = points
    .map(([x, y, t, d], i) => `.ac-decoration .ac-px-tw-${i + 1} { left: ${x}px; top: ${y}px; --ac-tw-t: ${t}s; --ac-tw-d: ${d}s; }`)
    .join("\n");
  const css = [
    `.ac-px-tw { width: ${px}px; height: ${px}px; background: ${core}; animation: ac-px-core var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }`,
    `.ac-px-tw::before, .ac-px-tw::after { content: ""; position: absolute; left: 0; top: 0; width: ${px}px; height: ${px}px; opacity: 0; }`,
    `.ac-px-tw::before { box-shadow: ${plus(px, arm)}; animation: ac-px-arms var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }`,
    `.ac-px-tw::after { box-shadow: ${plus(px * 2, tip)}; animation: ac-px-tips var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }`,
    "@keyframes ac-px-core { 0% { opacity: 0.55; } 45% { opacity: 1; } 75% { opacity: 0.8; } }",
    "@keyframes ac-px-arms { 0% { opacity: 0; } 45% { opacity: 1; } 72% { opacity: 0; } }",
    "@keyframes ac-px-tips { 0% { opacity: 0; } 52% { opacity: 1; } 62% { opacity: 0; } }",
    placed,
  ].join("\n      ");
  return {
    markup: () => points.map((_, i) => <span key={i} className={`ac-px-tw ac-px-tw-${i + 1}`} />),
    css,
  };
}
