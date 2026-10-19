import type { JSX } from "react";
import type { MotionParts } from "../motion";
import type { Theme } from "./index";
import type { Limb } from "./pixelArt";
import { BANDS, drawLimbs, fallingSprites, pixel, seeded } from "./pixelArt";

// Dark text over pink blossoms keeps a soft white halo.
const TEXT =
  ".ac-title, .ac-desc, .ac-eyebrow { text-shadow: 0 0 2px #fff, 0 0 4px rgb(255 243 247 / 0.95), 0 1px 0 rgb(255 255 255 / 0.8); }";

// Blossom-covered branches bursting in from the left edge over about half the card (art px):
// brown limbs first, then layered five-petal flowers clustered along them.
const LIMBS: Limb[] = [
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
const BARK: [string, string, string] = ["#8a5a44", "#7a4a3a", "#5a3428"]; // lit top, middle, shaded underside
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
  drawLimbs(LIMBS, put, BARK);
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

// Petals let go of the branches and drift down and right.
const PETALS = fallingSprites({
  name: "petal",
  count: 24,
  seed: 7,
  frames: [["PP.", ".PD"], [".P", "PP", "D."]],
  palettes: [
    { P: "#ff8fb3", D: "#e0457b" },
    { P: "#ffc2d6", D: "#ff8fb3" },
  ],
  area: { x: [0, 120], y: [-4, 32] },
  cycle: [5.5, 9.5],
  vector: [4, 2],
  steps: 40,
});

function Layer(): JSX.Element {
  return (
    <>
      <span className="ac-px-spr ac-px-branches" />
      <span className="ac-px-spr ac-px-shimmer-a" />
      <span className="ac-px-spr ac-px-shimmer-b" />
      {PETALS.markup()}
    </>
  );
}

function css(): MotionParts {
  return {
    always: `.ac-px-branches, .ac-px-shimmer-a, .ac-px-shimmer-b { left: 0; top: 0; }
      .ac-px-branches { box-shadow: ${SAKURA.branches}; }
      .ac-px-shimmer-a { box-shadow: ${SAKURA.glintA}; animation: ac-px-flap 1.4s steps(1, end) infinite; }
      .ac-px-shimmer-b { box-shadow: ${SAKURA.glintB}; animation: ac-px-flap 1.4s steps(1, end) -0.7s infinite; }
      ${PETALS.always}
      ${TEXT}`,
    full: PETALS.full,
    reduced: "",
  };
}

export const sakura: Theme = { Layer, css, background: BANDS, pixel: "banded" };
