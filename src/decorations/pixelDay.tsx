import type { JSX } from "react";
import type { MotionParts } from "../motion";
import type { Theme } from "./index";
import { BANDS, discSprite, looped, pixel, rowsSprite } from "./pixelArt";

// A hard 1px outline keeps text readable over white pixel clouds.
const TEXT =
  ".ac-title, .ac-desc { text-shadow: 1px 0 0 #2b5f8f, -1px 0 0 #2b5f8f, 0 1px 0 #2b5f8f, 0 -1px 0 #2b5f8f, 0 1px 3px rgb(25 60 90 / 0.6); }";

const SUN = discSprite(13, {
  body: "#ffd84a",
  rim: "#f0a81c",
  rimFrom: 5.1,
  highlight: (x, y) => (x - 4) ** 2 + (y - 4) ** 2 < 4,
  highlightColor: "#fff2a6",
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

function Layer(): JSX.Element {
  return (
    <>
      <span className="ac-px-spr ac-px-clouds-back" />
      <span className="ac-px-spr ac-px-clouds-front" />
      <span className="ac-px-birds">
        <span className="ac-px-spr ac-px-birds-up" />
        <span className="ac-px-spr ac-px-birds-flat" />
      </span>
      <span className="ac-px-spr ac-px-sun" />
      <span className="ac-px-spr ac-px-rays-a" />
      <span className="ac-px-spr ac-px-rays-b" />
    </>
  );
}

function css(): MotionParts {
  return {
    always: `.ac-compact .ac-px-sun, .ac-compact .ac-px-rays-a, .ac-compact .ac-px-rays-b { top: 22px; }
      .ac-px-clouds-back { left: 0; bottom: 24px; box-shadow: ${BACK_CLOUDS}; }
      .ac-px-clouds-front { left: 0; bottom: 16px; box-shadow: ${FRONT_CLOUDS}; }
      .ac-px-birds { left: 100%; top: 14px; }
      .ac-px-birds-up { box-shadow: ${BIRDS_UP}; animation: ac-px-flap 0.5s steps(1, end) infinite; }
      .ac-px-birds-flat { box-shadow: ${BIRDS_FLAT}; animation: ac-px-flap 0.5s steps(1, end) -0.25s infinite; }
      .ac-px-sun, .ac-px-rays-a, .ac-px-rays-b { right: 38px; top: 26px; }
      .ac-px-sun { box-shadow: ${SUN}; }
      .ac-px-rays-a { box-shadow: ${SUN_RAYS_A}; animation: ac-px-flap 1.2s steps(1, end) infinite; }
      .ac-px-rays-b { box-shadow: ${SUN_RAYS_B}; animation: ac-px-flap 1.2s steps(1, end) -0.6s infinite; }
      ${TEXT}`,
    full: `.ac-px-clouds-front { animation: ac-px-drift 26s steps(146, end) infinite; }
      .ac-px-clouds-back { animation: ac-px-drift 48s steps(146, end) infinite; }
      .ac-px-birds { animation: ac-px-fly 18s steps(198, end) infinite; }
      @keyframes ac-px-fly { to { translate: -396px 0; } }`,
    reduced: "",
  };
}

export const pixelDay: Theme = { Layer, css, background: BANDS, pixel: "banded" };
