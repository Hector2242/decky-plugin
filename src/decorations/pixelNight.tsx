import type { JSX } from "react";
import type { MotionParts } from "../motion";
import type { Theme } from "./index";
import { BANDS, gridSprite, looped, pixel, twinkleStars } from "./pixelArt";

const TEXT = ".ac-title, .ac-desc { text-shadow: 0 0 8px rgb(20 22 35 / 0.9), 0 1px 3px rgb(0 0 0 / 0.6); }";

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
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
const TWINKLES = twinkleStars([
  [12, 8, 3.2, -1.1], [58, 30, 2.7, -0.3], [104, 10, 3.9, -2.4],
  [150, 36, 3.4, -1.7], [196, 14, 2.9, -0.8], [264, 56, 4.2, -3.1],
]);

function Layer(): JSX.Element {
  return (
    <>
      <span className="ac-px-spr ac-px-far" />
      <span className="ac-px-spr ac-px-blink" />
      {TWINKLES.markup()}
      <span className="ac-px-spr ac-px-shoot" />
      <span className="ac-px-spr ac-px-moon" />
    </>
  );
}

function css(): MotionParts {
  return {
    always: `.ac-compact .ac-px-moon { top: 22px; }
      .ac-px-far, .ac-px-blink { left: 0; top: 0; }
      .ac-px-far { box-shadow: ${FAR_STARS}; }
      .ac-px-blink { box-shadow: ${BLINK_STARS}; animation: ac-px-blink 2.8s steps(1, end) infinite; }
      ${TWINKLES.css}
      .ac-px-shoot { left: 30px; top: 6px; opacity: 0; box-shadow: ${SHOOTING_STAR}; }
      .ac-px-moon { right: 36px; top: 26px; box-shadow: ${MOON}; }
      ${TEXT}`,
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

export const pixelNight: Theme = { Layer, css, background: BANDS, pixel: "banded" };
