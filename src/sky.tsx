import type { Decoration } from "./settings";
import type { MotionParts } from "./motion";

// Skies follow the Primary/Secondary colors. The pixel ones are four 20px bands like a 16-bit gradient,
// from --ac-px-b0 (Secondary) at the top to --ac-px-b3 (Primary); PIXEL_BASE defines the band variables.
const SMOOTH_SKY = "linear-gradient(160deg, var(--ac-primary) 0%, var(--ac-secondary) 100%)";
const BANDS =
  "linear-gradient(180deg, var(--ac-px-b0) 0 20px, var(--ac-px-b1) 20px 40px, var(--ac-px-b2) 40px 60px, var(--ac-px-b3) 60px)";

/** Card background for decorations that paint their own sky, otherwise null. */
export function skyBackground(d: Decoration): string | null {
  switch (d) {
    case "sky-day":
    case "sky-night":
      return SMOOTH_SKY;
    case "pixel-day":
    case "pixel-night":
    case "pixel-sakura":
      return BANDS;
    default:
      return null;
  }
}

export function hasSkyBackground(d: Decoration): boolean {
  return skyBackground(d) !== null;
}

// ---------------------------------------------------------------------------
// Smooth decorations

const SPARKLES = [
  { top: "18%", left: "16%", size: 10, delay: 0, duration: 2.4 },
  { top: "64%", left: "12%", size: 7, delay: 0.9, duration: 2.8 },
  { top: "34%", left: "27%", size: 6, delay: 1.7, duration: 2.2 },
  { top: "78%", left: "33%", size: 9, delay: 0.45, duration: 3.0 },
  { top: "12%", left: "43%", size: 8, delay: 1.3, duration: 2.6 },
  { top: "70%", left: "51%", size: 6, delay: 2.1, duration: 2.4 },
  { top: "26%", left: "58%", size: 12, delay: 0.7, duration: 3.2 },
  { top: "80%", left: "66%", size: 7, delay: 1.55, duration: 2.5 },
  { top: "20%", left: "74%", size: 9, delay: 2.35, duration: 2.9 },
  { top: "58%", left: "80%", size: 8, delay: 1.05, duration: 2.7 },
];

const STARS = [
  [2, 10, 5, 0, 2.5], [3, 24, 16, 0.3, 2.5], [2, 78, 9, 0.7, 2.5], [2, 55, 22, 1.2, 2.5],
  [4, 12, 31, 1.8, 2.5], [2, 83, 28, 0.5, 2.5], [2, 8, 42, 1.5, 2.5], [3, 85, 48, 0.9, 2.5],
  [2, 16, 54, 0.4, 1.8], [2, 74, 59, 1.1, 2.5], [2, 10, 65, 0.8, 3.5], [3, 81, 71, 1.6, 2.5],
  [2, 20, 77, 0.2, 2.5], [2, 68, 83, 1.9, 1.8], [3, 12, 89, 0.6, 3.5], [2, 86, 93, 1.3, 2.5],
];

const CONSTELLATION_PATH =
  "M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688Z";

const CONSTELLATIONS = [
  { top: "15%", left: "12%", width: 8, opacity: 0.7 },
  { top: "62%", left: "36%", width: 6, opacity: 0.4 },
  { top: "26%", left: "58%", width: 10, opacity: 0.8 },
  { top: "67%", left: "80%", width: 7, opacity: 0.5 },
];

function ConstellationHalf() {
  return (
    <div className="ac-drift-half">
      {CONSTELLATIONS.map((c, i) => (
        <svg key={i} className="ac-constellation" viewBox="133 0 8 9" style={{ top: c.top, left: c.left, width: c.width, opacity: c.opacity }}>
          <path d={CONSTELLATION_PATH} />
        </svg>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pixel art: each art pixel is a 2x2 box-shadow (offset to its centre, 1px spread) of a 0x0
// element, so a sprite paints once and only ever moves on the compositor.

function pixel(x: number, y: number, color: string): string {
  return `${x * 2 + 1}px ${y * 2 + 1}px 0 1px ${color}`;
}

function rowsSprite(rows: string[], palette: Record<string, string>, dx = 0, dy = 0): string[] {
  const out: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color) out.push(pixel(x + dx, y + dy, color));
    }
  });
  return out;
}

function gridSprite(size: number, colorAt: (x: number, y: number) => string | null): string {
  const out: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = colorAt(x, y);
      if (color) out.push(pixel(x, y, color));
    }
  }
  return out.join(", ");
}

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Drifting layers hold three copies 146 art px (292 CSS px) apart, so translating by -292px loops
// seamlessly on toasts and QAM previews up to 584px wide.
function looped(build: (dx: number) => string[]): string {
  return [...build(0), ...build(146), ...build(292)].join(", ");
}

const MOON = gridSprite(12, (x, y) => {
  const disc = (a: number, b: number): boolean => inCircle(a, b, 5.5, 5.5, 5.7);
  const shade = (a: number, b: number): boolean => inCircle(a, b, 8.2, 3.8, 4.6);
  const near = (test: (a: number, b: number) => boolean): boolean =>
    test(x - 1, y) || test(x + 1, y) || test(x, y - 1) || test(x, y + 1);
  if (!disc(x, y) || shade(x, y)) return null;
  if (near((a, b) => !disc(a, b))) return "#9aa3c7";
  if (near(shade)) return "#c3cae8";
  return "#eef1ff";
});

const SUN = gridSprite(13, (x, y) => {
  const d = Math.hypot(x - 6, y - 6);
  if (d > 6.2) return null;
  if (d > 5.1) return "#f0a81c";
  return (x - 4) ** 2 + (y - 4) ** 2 < 4 ? "#fff2a6" : "#ffd84a";
});

function rays(at: [number, number][]): string {
  return at.map(([x, y]) => pixel(x, y, "#ffe27a")).join(", ");
}
const SUN_RAYS_A = rays([[6, -2], [6, 14], [-2, 6], [14, 6]]);
const SUN_RAYS_B = rays([[-1, -1], [13, -1], [-1, 13], [13, 13]]);

const CLOUD_BIG = [
  ".......WWWW...........",
  ".....WWWWWWWW.........",
  "....WWWWWWWWWW.WWWW...",
  "..WWWWWWWWWWWWWWWWWWW.",
  ".WWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWWWWWWWW",
  "SWWWWWWWWWWWWWWWWWWWWS",
  ".SSSSSSSSSSSSSSSSSSSS.",
];
const CLOUD_SMALL = ["....WWWW.....", "..WWWWWWWWW..", ".WWWWWWWWWWW.", "WWWWWWWWWWWWW", ".SSSSSSSSSSS."];
const CLOUD_FRONT = { W: "#ffffff", S: "#cfe6f7" };
const CLOUD_BACK = { W: "#dceefb", S: "#b9d8f0" };
const FRONT_CLOUDS = looped((dx) => [
  ...rowsSprite(CLOUD_BIG, CLOUD_FRONT, 4 + dx),
  ...rowsSprite(CLOUD_SMALL, CLOUD_FRONT, 60 + dx, 3),
  ...rowsSprite(CLOUD_BIG, CLOUD_FRONT, 98 + dx),
]);
const BACK_CLOUDS = looped((dx) => [
  ...rowsSprite(CLOUD_SMALL, CLOUD_BACK, 26 + dx),
  ...rowsSprite(CLOUD_SMALL, CLOUD_BACK, 84 + dx, 1),
  ...rowsSprite(CLOUD_SMALL, CLOUD_BACK, 126 + dx),
]);

const BIRD = { "#": "#2b5f8f" };
const BIRDS_UP = rowsSprite(["#...#..", ".#.#...", "..#....", ".......", "..#...#", "...#.#.", "....#.."], BIRD).join(", ");
const BIRDS_FLAT = rowsSprite([".......", "##.##..", "..#....", ".......", ".......", "..##.##", "....#.."], BIRD).join(", ");

const STAR_TONES = ["#ffffff", "#c9d3ff", "#8f9bd8", "#8f9bd8"];
const FAR_STAR_AT: [number, number, number][] = [
  [0, 37, 0], [42, 9, 1], [106, 22, 2], [48, 31, 3], [110, 22, 0], [99, 26, 1], [119, 10, 2],
  [54, 29, 3], [101, 3, 0], [99, 19, 1], [134, 33, 2], [17, 21, 3], [134, 28, 0], [93, 24, 1],
  [133, 37, 2], [54, 14, 3], [122, 14, 0], [22, 12, 1], [62, 12, 2], [136, 23, 3], [106, 36, 0],
  [8, 11, 1], [81, 21, 2], [61, 8, 3], [132, 3, 0], [53, 14, 1],
];
const FAR_STARS = looped((dx) => FAR_STAR_AT.map(([x, y, tone]) => pixel(x + dx, y, STAR_TONES[tone])));
const BLINK_STAR_AT: [number, number][] = [[20, 30], [41, 6], [70, 24], [92, 38], [118, 8], [133, 30], [8, 14], [55, 40]];
const BLINK_STARS = BLINK_STAR_AT.map(([x, y]) => pixel(x, y, "#ffffff")).join(", ");
const SHOOTING_STAR_AT: [number, number, string][] = [
  [0, 0, "#ffffff"], [-1, 0, "#ffffff"], [-2, 0, "#e3e8ff"], [-3, -1, "#c9d3ff"], [-4, -1, "#c9d3ff"],
  [-5, -1, "#a6b1e8"], [-6, -2, "#8f9bd8"], [-7, -2, "#717cba"], [-8, -2, "#5b6496"],
];
const SHOOTING_STAR = SHOOTING_STAR_AT.map(([x, y, c]) => pixel(x, y, c)).join(", ");
// Sparkle stars: left px, top px, cycle s, phase s.
const TWINKLES: [number, number, number, number][] = [
  [12, 8, 3.2, -1.1], [58, 30, 2.7, -0.3], [104, 10, 3.9, -2.4],
  [150, 36, 3.4, -1.7], [196, 14, 2.9, -0.8], [264, 56, 4.2, -3.1],
];

// Seeded (mulberry32) so every toast draws exactly the same branches and petals.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Blossom-covered branches bursting in from the left edge over about half the card (art px):
// brown limbs first, then layered five-petal flowers clustered along them.
const LIMBS: [number, number, number, number, number][] = [
  // x0, y0, x1, y1, thickness
  [-1, 4, 16, 8, 4], [16, 8, 30, 7, 3], [30, 7, 46, 10, 2], [46, 10, 60, 8, 2], [60, 8, 70, 10, 1],
  [16, 8, 26, 15, 2], [26, 15, 38, 20, 1],
  [-1, 27, 12, 23, 4], [12, 23, 26, 26, 3], [26, 26, 40, 31, 2], [40, 31, 52, 30, 1],
  [12, 23, 20, 16, 1],
  [-1, 38, 10, 35, 2], [10, 35, 22, 38, 1],
];
const CLUSTERS: [number, number, number, number][] = [
  // x, y, radius, flowers
  [4, 2, 6, 15], [12, 4, 6, 18], [20, 4, 6, 18], [28, 3, 6, 15], [36, 6, 6, 15], [44, 7, 6, 15],
  [52, 6, 6, 14], [60, 6, 5, 12], [68, 8, 5, 10], [70, 3, 4, 7], [62, 14, 5, 10], [56, 14, 4, 7],
  [22, 12, 5, 12], [30, 16, 5, 11], [38, 19, 5, 10], [66, 20, 4, 6],
  [4, 24, 6, 15], [10, 19, 5, 12], [18, 22, 6, 15], [26, 24, 5, 12], [34, 28, 5, 11], [44, 29, 5, 11],
  [52, 28, 5, 9], [58, 22, 4, 7], [20, 15, 4, 9], [4, 35, 5, 11], [14, 34, 4, 9],
];
const BARK = ["#8a5a44", "#7a4a3a", "#5a3428"]; // lit top, middle, shaded underside
const BLOSSOM = { soft: "#ffc3d7", light: "#ffd6e5", mid: "#ff9ec0", deep: "#f37ea6", heart: "#e0457b" };

function drawBranches(): { branches: string; glintA: string; glintB: string } {
  const rand = seeded(29);
  const art = new Map<string, string>();
  const put = (x: number, y: number, color: string): void => {
    if (x >= 0 && y >= 0 && y <= 42) art.set(`${x},${y}`, color);
  };
  // A soft blossom mass behind the branches, so each cluster reads as full bloom.
  for (const [cx, cy, r] of CLUSTERS) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + 2 * dy * dy <= r * r && rand() < 0.6) put(cx + dx, cy + dy, rand() < 0.5 ? BLOSSOM.soft : BLOSSOM.mid);
      }
    }
  }
  for (const [x0, y0, x1, y1, w] of LIMBS) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps - w / 2);
      for (let k = 0; k < w; k++) put(x, y + k, w === 1 ? BARK[1] : BARK[k === 0 ? 0 : k === w - 1 ? 2 : 1]);
    }
  }
  const hearts: [number, number][] = [];
  for (const [cx, cy, r, n] of CLUSTERS) {
    for (let i = 0; i < n; i++) {
      const x = cx + Math.round((rand() * 2 - 1) * r);
      const y = cy + Math.round((rand() * 2 - 1) * r * 0.7);
      const petal = rand() < 0.3 ? BLOSSOM.deep : BLOSSOM.mid;
      put(x, y - 1, BLOSSOM.light);
      put(x - 1, y, BLOSSOM.light);
      put(x + 1, y, petal);
      put(x, y + 1, petal);
      if (rand() < 0.6) {
        put(x - 1, y - 1, BLOSSOM.light);
        put(x + 1, y + 1, petal);
        put(x + 1, y - 1, BLOSSOM.mid);
        put(x - 1, y + 1, BLOSSOM.mid);
      }
      put(x, y, BLOSSOM.heart);
      hearts.push([x, y]);
    }
  }
  // Two sets of glints on the flowers take turns.
  const glints = (offset: number): string =>
    hearts
      .filter((_, i) => i % 9 === offset)
      .slice(0, 6)
      .map(([x, y]) => pixel(x, y - 1, "#fff4f8"))
      .join(", ");
  const branches = [...art].map(([key, color]) => {
    const [x, y] = key.split(",").map(Number);
    return pixel(x, y, color);
  });
  return { branches: branches.join(", "), glintA: glints(0), glintB: glints(4) };
}
const SAKURA = drawBranches();

// A falling petal flutters between two frames, in a deep and a pale pink.
const PETAL_FRAMES = [["PP.", ".PD"], [".P", "PP", "D."]];
const PETAL_SPRITES = [
  { P: "#ff8fb3", D: "#e0457b" },
  { P: "#ffc2d6", D: "#ff8fb3" },
].map((palette) => PETAL_FRAMES.map((rows) => rowsSprite(rows, palette).join(", ")));
// Petals drop from the branches: left px, top px, fall cycle s, phase s.
const PETALS: [number, number, number, number][] = (() => {
  const rand = seeded(7);
  return Array.from({ length: 24 }, (): [number, number, number, number] => {
    const cycle = Math.round((5.5 + rand() * 4) * 10) / 10;
    return [Math.round(rand() * 60) * 2, Math.round(rand() * 18) * 2 - 4, cycle, -Math.round(rand() * cycle * 10) / 10];
  });
})();

export function SkyLayer({ variant }: { variant: Decoration }) {
  if (variant === "sparkles") {
    return (
      <div className="ac-sky">
        {SPARKLES.map((_, i) => (
          <div key={i} className={`ac-sparkle ac-sparkle-${i + 1}`} />
        ))}
      </div>
    );
  }
  if (variant === "sky-day") {
    return (
      <div className="ac-sky">
        <div className="ac-sun" />
        <svg className="ac-birds" viewBox="0 0 60 20" width="40" height="20">
          <path d="M2 10 Q 7 2 12 10 Q 17 2 22 10" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 15 Q 30 7 35 15 Q 40 7 45 15" fill="none" stroke="#FFF8E7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-back">
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
            <div className="ac-drift-half"><div className="ac-cloud-3" /></div>
          </div>
        </div>
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-front">
            <div className="ac-drift-half"><div className="ac-cloud-1" /><div className="ac-cloud-2" /></div>
            <div className="ac-drift-half"><div className="ac-cloud-1" /><div className="ac-cloud-2" /></div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === "sky-night") {
    return (
      <div className="ac-sky">
        <div className="ac-moon" />
        {STARS.map((_, i) => (
          <div key={i} className={`ac-star ac-star-${i + 1}`} />
        ))}
        <div className="ac-drift">
          <div className="ac-drift-track ac-drift-stars">
            <ConstellationHalf />
            <ConstellationHalf />
          </div>
        </div>
      </div>
    );
  }
  if (variant === "pixel-day") {
    return (
      <div className="ac-sky ac-px-sky">
        <span className="ac-px-dither ac-px-d1" />
        <span className="ac-px-dither ac-px-d2" />
        <span className="ac-px-dither ac-px-d3" />
        <span className="ac-px-spr ac-px-clouds-back" />
        <span className="ac-px-spr ac-px-clouds-front" />
        <span className="ac-px-birds">
          <span className="ac-px-spr ac-px-birds-up" />
          <span className="ac-px-spr ac-px-birds-flat" />
        </span>
        <span className="ac-px-spr ac-px-sun" />
        <span className="ac-px-spr ac-px-rays-a" />
        <span className="ac-px-spr ac-px-rays-b" />
      </div>
    );
  }
  if (variant === "pixel-night") {
    return (
      <div className="ac-sky ac-px-sky">
        <span className="ac-px-dither ac-px-d1" />
        <span className="ac-px-dither ac-px-d2" />
        <span className="ac-px-dither ac-px-d3" />
        <span className="ac-px-spr ac-px-far" />
        <span className="ac-px-spr ac-px-blink" />
        {TWINKLES.map((_, i) => (
          <span key={i} className={`ac-px-tw ac-px-tw-${i + 1}`} />
        ))}
        <span className="ac-px-spr ac-px-shoot" />
        <span className="ac-px-spr ac-px-moon" />
      </div>
    );
  }
  if (variant === "pixel-sakura") {
    return (
      <div className="ac-sky ac-px-sky">
        <span className="ac-px-dither ac-px-d1" />
        <span className="ac-px-dither ac-px-d2" />
        <span className="ac-px-dither ac-px-d3" />
        <span className="ac-px-spr ac-px-branches" />
        <span className="ac-px-spr ac-px-shimmer-a" />
        <span className="ac-px-spr ac-px-shimmer-b" />
        {PETALS.map((_, i) => (
          <span key={i} className={`ac-px-petal ac-px-petal-${i + 1}`}>
            <span className={`ac-px-spr ac-px-flutter-${i % 2 ? "c" : "a"}`} />
            <span className={`ac-px-spr ac-px-flutter-${i % 2 ? "d" : "b"}`} />
          </span>
        ))}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSS. Per-element timing rules carry `.ac-sky` so the animation shorthands in either motion
// branch cannot reset them; opacity-only effects run in every mode.

const NO_SKY: MotionParts = { always: "", full: "", reduced: "" };
const DAY_TEXT = ".ac-title, .ac-desc { text-shadow: 0 1px 3px rgb(25 60 90 / 0.7), 0 0 6px rgb(25 60 90 / 0.35); }";
const NIGHT_TEXT = ".ac-title, .ac-desc { text-shadow: 0 0 8px rgb(20 22 35 / 0.9), 0 1px 3px rgb(0 0 0 / 0.6); }";
// A hard 1px outline keeps text readable over white pixel clouds.
const PIXEL_DAY_TEXT =
  ".ac-title, .ac-desc { text-shadow: 1px 0 0 #2b5f8f, -1px 0 0 #2b5f8f, 0 1px 0 #2b5f8f, 0 -1px 0 #2b5f8f, 0 1px 3px rgb(25 60 90 / 0.6); }";
// Dark text over pink blossoms keeps a soft white halo.
const SAKURA_TEXT =
  ".ac-title, .ac-desc, .ac-eyebrow { text-shadow: 0 0 2px #fff, 0 0 4px rgb(255 243 247 / 0.95), 0 1px 0 rgb(255 255 255 / 0.8); }";
const DRIFT_KEYFRAMES = "@keyframes ac-drift-left { to { transform: translateX(-50%); } }";
const SKY_BASE = `
  .ac-sky { position: absolute; inset: 0; overflow: hidden; border-radius: calc(var(--ac-radius) - 2px); pointer-events: none; z-index: 0; }
  .ac-drift { position: absolute; inset: 0; overflow: hidden; }
  .ac-drift-track { display: flex; width: 200%; height: 100%; }
  .ac-drift-half { width: 50%; height: 100%; position: relative; }
  .ac-compact .ac-sun, .ac-compact .ac-moon { top: 18px; }
  @keyframes ac-glow { from { opacity: 0.35; } to { opacity: 1; } }`;
const PIXEL_BASE = `
  .ac-toast { --ac-px-b0: var(--ac-secondary); --ac-px-b1: color-mix(in srgb, var(--ac-primary) 33%, var(--ac-secondary)); --ac-px-b2: color-mix(in srgb, var(--ac-primary) 67%, var(--ac-secondary)); --ac-px-b3: var(--ac-primary); }
  .ac-px-sky span { position: absolute; display: block; }
  .ac-px-dither { left: 0; right: 0; height: 4px; }
  .ac-px-spr { width: 0; height: 0; }
  .ac-compact .ac-px-sun, .ac-compact .ac-px-rays-a, .ac-compact .ac-px-rays-b, .ac-compact .ac-px-moon { top: 22px; }
  @keyframes ac-px-flap { 0% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes ac-px-drift { to { translate: -292px 0; } }`;

// 2px checkerboard strips over each band edge.
const DITHER = [0, 1, 2]
  .map((i) => `.ac-px-sky .ac-px-d${i + 1} { top: ${18 + i * 20}px; background: repeating-conic-gradient(var(--ac-px-b${i}) 0 25%, var(--ac-px-b${i + 1}) 0 50%) 0 0 / 4px 4px; }`)
  .join("\n");

function sparklesCSS(): MotionParts {
  const each = SPARKLES.map(
    (sp, i) =>
      `.ac-sky .ac-sparkle-${i + 1} { top: ${sp.top}; left: ${sp.left}; width: ${sp.size}px; height: ${sp.size}px; animation-delay: ${sp.delay}s; animation-duration: ${sp.duration}s; }`,
  ).join("\n");
  return {
    always: `${SKY_BASE}
      .ac-sparkle { position: absolute; background: var(--ac-accent); clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%); opacity: 0; box-shadow: 0 0 6px rgb(var(--ac-accent-rgb) / 0.67); }
      ${each}`,
    full: `.ac-sparkle { animation: ac-sparkle 2.5s ease-in-out infinite; }
      @keyframes ac-sparkle { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(0deg); } 35% { opacity: 1; transform: scale(1) rotate(25deg); } 65% { opacity: 0.85; transform: scale(0.9) rotate(35deg); } }`,
    reduced: ".ac-sparkle { animation: ac-glow 2.5s ease-in-out infinite alternate; }",
  };
}

function skyDayCSS(): MotionParts {
  return {
    always: `${SKY_BASE}
      .ac-sun { position: absolute; top: 26px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: #ECCA2F; box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.6), inset 0 -1px 2px rgb(161 135 42 / 0.5), 0 0 12px rgb(236 202 47 / 0.35); animation: ac-sun 4s ease-in-out infinite; }
      @keyframes ac-sun { 50% { box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.6), inset 0 -1px 2px rgb(161 135 42 / 0.5), 0 0 18px rgb(236 202 47 / 0.7); } }
      .ac-birds { position: absolute; top: 22%; left: 40%; opacity: 0.5; }
      .ac-cloud-1, .ac-cloud-2, .ac-cloud-3 { position: absolute; border-radius: 50%; }
      .ac-cloud-1 { width: 26px; height: 26px; background: #F3FDFF; top: 82%; left: 4%; box-shadow: 20px -6px 0 7px #F3FDFF, 44px 3px 0 -3px #F3FDFF, -15px 5px 0 -5px #F3FDFF; }
      .ac-cloud-2 { width: 32px; height: 32px; background: #F3FDFF; top: 80%; left: 55%; box-shadow: 24px 7px 0 -3px #F3FDFF, 48px -5px 0 5px #F3FDFF, -21px 9px 0 -7px #F3FDFF, 69px 9px 0 -6px #F3FDFF; }
      .ac-cloud-3 { width: 28px; height: 28px; background: #AACADF; top: 74%; left: 28%; box-shadow: 27px -5px 0 4px #AACADF, 57px 7px 0 -3px #AACADF, -24px 7px 0 -6px #AACADF, 81px -3px 0 5px #AACADF, 111px 6px 0 -5px #AACADF; }
      .ac-drift-back { opacity: 0.7; }
      .ac-drift-front { opacity: 0.9; }
      ${DAY_TEXT}`,
    full: `.ac-drift-back { animation: ac-drift-left 30s linear infinite; }
      .ac-drift-front { animation: ac-drift-left 20s linear infinite; }
      ${DRIFT_KEYFRAMES}`,
    reduced: "",
  };
}

function skyNightCSS(): MotionParts {
  const stars = STARS.map(
    ([size, top, left, delay, dur], i) =>
      `.ac-sky .ac-star-${i + 1} { width: ${size}px; height: ${size}px; top: ${top}%; left: ${left}%; animation-delay: ${delay}s; animation-duration: ${dur}s; }`,
  ).join("\n");
  return {
    always: `${SKY_BASE}
      .ac-moon { position: absolute; top: 26px; right: 11px; width: 26px; height: 26px; animation: ac-moon 5s ease-in-out infinite; }
      .ac-moon::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #C4C9D1; box-shadow: inset 1px 1px 2px rgb(254 255 239 / 0.5); -webkit-mask: radial-gradient(circle at 76% 41%, transparent 44%, #000 45%); mask: radial-gradient(circle at 76% 41%, transparent 44%, #000 45%); }
      @keyframes ac-moon { 50% { filter: drop-shadow(0 0 5px rgb(255 255 255 / 0.45)); } }
      .ac-star { position: absolute; background: #fff; border-radius: 50%; box-shadow: 0 0 4px rgb(255 255 255 / 0.85); }
      ${stars}
      .ac-constellation { position: absolute; fill: #fff; }
      ${NIGHT_TEXT}`,
    full: `.ac-star { animation: ac-twinkle 2.5s ease-in-out infinite alternate; }
      @keyframes ac-twinkle { from { opacity: 0.25; transform: scale(0.7); } to { opacity: 1; transform: scale(1.25); } }
      .ac-drift-stars { animation: ac-drift-left 60s linear infinite; }
      ${DRIFT_KEYFRAMES}`,
    reduced: ".ac-star { animation: ac-glow 2.5s ease-in-out infinite alternate; }",
  };
}

function pixelDayCSS(): MotionParts {
  return {
    always: `${SKY_BASE}${PIXEL_BASE}
      ${DITHER}
      .ac-px-clouds-back { left: 0; bottom: 24px; box-shadow: ${BACK_CLOUDS}; }
      .ac-px-clouds-front { left: 0; bottom: 16px; box-shadow: ${FRONT_CLOUDS}; }
      .ac-px-birds { left: 100%; top: 14px; }
      .ac-px-birds-up { box-shadow: ${BIRDS_UP}; animation: ac-px-flap 0.5s steps(1, end) infinite; }
      .ac-px-birds-flat { box-shadow: ${BIRDS_FLAT}; animation: ac-px-flap 0.5s steps(1, end) -0.25s infinite; }
      .ac-px-sun, .ac-px-rays-a, .ac-px-rays-b { right: 38px; top: 26px; }
      .ac-px-sun { box-shadow: ${SUN}; }
      .ac-px-rays-a { box-shadow: ${SUN_RAYS_A}; animation: ac-px-flap 1.2s steps(1, end) infinite; }
      .ac-px-rays-b { box-shadow: ${SUN_RAYS_B}; animation: ac-px-flap 1.2s steps(1, end) -0.6s infinite; }
      ${PIXEL_DAY_TEXT}`,
    full: `.ac-px-clouds-front { animation: ac-px-drift 26s steps(146, end) infinite; }
      .ac-px-clouds-back { animation: ac-px-drift 48s steps(146, end) infinite; }
      .ac-px-birds { animation: ac-px-fly 18s steps(198, end) infinite; }
      @keyframes ac-px-fly { to { translate: -396px 0; } }`,
    reduced: "",
  };
}

function pixelNightCSS(): MotionParts {
  const twinkles = TWINKLES.map(
    ([x, y, t, d], i) => `.ac-sky .ac-px-tw-${i + 1} { left: ${x}px; top: ${y}px; --ac-tw-t: ${t}s; --ac-tw-d: ${d}s; }`,
  ).join("\n");
  return {
    always: `${SKY_BASE}${PIXEL_BASE}
      ${DITHER}
      .ac-px-far, .ac-px-blink { left: 0; top: 0; }
      .ac-px-far { box-shadow: ${FAR_STARS}; }
      .ac-px-blink { box-shadow: ${BLINK_STARS}; animation: ac-px-blink 2.8s steps(1, end) infinite; }
      @keyframes ac-px-blink { 0% { opacity: 1; } 30% { opacity: 0.35; } 45% { opacity: 1; } 70% { opacity: 0.5; } 85% { opacity: 1; } }
      .ac-px-tw { width: 2px; height: 2px; background: #fff; animation: ac-px-core var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }
      .ac-px-tw::before, .ac-px-tw::after { content: ""; position: absolute; left: 0; top: 0; width: 2px; height: 2px; opacity: 0; }
      .ac-px-tw::before { box-shadow: 2px 0 #c9d3ff, -2px 0 #c9d3ff, 0 2px #c9d3ff, 0 -2px #c9d3ff; animation: ac-px-arms var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }
      .ac-px-tw::after { box-shadow: 4px 0 #7f8cc9, -4px 0 #7f8cc9, 0 4px #7f8cc9, 0 -4px #7f8cc9; animation: ac-px-tips var(--ac-tw-t) steps(1, end) var(--ac-tw-d) infinite; }
      @keyframes ac-px-core { 0% { opacity: 0.55; } 45% { opacity: 1; } 75% { opacity: 0.8; } }
      @keyframes ac-px-arms { 0% { opacity: 0; } 45% { opacity: 1; } 72% { opacity: 0; } }
      @keyframes ac-px-tips { 0% { opacity: 0; } 52% { opacity: 1; } 62% { opacity: 0; } }
      ${twinkles}
      .ac-px-shoot { left: 30px; top: 6px; opacity: 0; box-shadow: ${SHOOTING_STAR}; }
      .ac-px-moon { right: 36px; top: 26px; box-shadow: ${MOON}; }
      ${NIGHT_TEXT}`,
    full: `.ac-px-far { animation: ac-px-drift 90s steps(146, end) infinite; }
      .ac-px-shoot { animation: ac-px-shoot 6.5s 0.8s infinite; }
      @keyframes ac-px-shoot {
        0% { translate: 0 0; opacity: 1; animation-timing-function: steps(16, end); }
        9% { translate: 96px 32px; opacity: 1; animation-timing-function: steps(1, end); }
        9.5%, 100% { translate: 96px 32px; opacity: 0; }
      }`,
    reduced: "",
  };
}

function pixelSakuraCSS(): MotionParts {
  const petals = PETALS.map(
    ([x, y, t, d], i) => `.ac-sky .ac-px-petal-${i + 1} { left: ${x}px; top: ${y}px; --ac-pt-t: ${t}s; --ac-pt-d: ${d}s; }`,
  ).join("\n");
  const [[deepA, deepB], [paleA, paleB]] = PETAL_SPRITES;
  return {
    always: `${SKY_BASE}${PIXEL_BASE}
      ${DITHER}
      .ac-px-branches, .ac-px-shimmer-a, .ac-px-shimmer-b { left: 0; top: 0; }
      .ac-px-branches { box-shadow: ${SAKURA.branches}; }
      .ac-px-shimmer-a { box-shadow: ${SAKURA.glintA}; animation: ac-px-flap 1.4s steps(1, end) infinite; }
      .ac-px-shimmer-b { box-shadow: ${SAKURA.glintB}; animation: ac-px-flap 1.4s steps(1, end) -0.7s infinite; }
      .ac-px-petal { opacity: 0; }
      .ac-px-flutter-a { box-shadow: ${deepA}; animation: ac-px-flap 0.6s steps(1, end) infinite; }
      .ac-px-flutter-b { box-shadow: ${deepB}; animation: ac-px-flap 0.6s steps(1, end) -0.3s infinite; }
      .ac-px-flutter-c { box-shadow: ${paleA}; animation: ac-px-flap 0.6s steps(1, end) infinite; }
      .ac-px-flutter-d { box-shadow: ${paleB}; animation: ac-px-flap 0.6s steps(1, end) -0.3s infinite; }
      ${petals}
      ${SAKURA_TEXT}`,
    // Petals let go of the branches and drift down and right, +4px/+2px per step on the pixel grid.
    full: `.ac-px-petal { animation: ac-px-fall var(--ac-pt-t) steps(40, end) var(--ac-pt-d) infinite; }
      @keyframes ac-px-fall {
        0% { translate: 0 0; opacity: 0; }
        6% { opacity: 1; }
        85% { opacity: 1; }
        100% { translate: 160px 80px; opacity: 0; }
      }`,
    reduced: "",
  };
}

export function skyCSS(d: Decoration): MotionParts {
  switch (d) {
    case "sparkles":
      return sparklesCSS();
    case "sky-day":
      return skyDayCSS();
    case "sky-night":
      return skyNightCSS();
    case "pixel-day":
      return pixelDayCSS();
    case "pixel-night":
      return pixelNightCSS();
    case "pixel-sakura":
      return pixelSakuraCSS();
    default:
      return NO_SKY;
  }
}
