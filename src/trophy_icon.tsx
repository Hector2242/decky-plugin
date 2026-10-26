/**
 * @fileoverview The trophy a toast's icon turns into. Its parts carry classes
 * that toast.tsx paints in the tier's light, base and dark tones.
 */

const STAR =
  'M32 15.3L33.53 19.4L37.9 19.58L34.47 22.3L35.64 26.52L32 24.1L28.36 26.52L29.53 22.3L26.1 19.58L30.47 19.4Z';
const GLINT = 'M51 1L52.3 5.7L57 7L52.3 8.3L51 13L49.7 8.3L45 7L49.7 5.7Z';
// Two more sparkles that only platinum shows.
const GLINT_2 = 'M9 16L9.9 19.1L13 20L9.9 20.9L9 24L8.1 20.9L5 20L8.1 19.1Z';
const GLINT_3 =
  'M55 40.5L55.8 43.2L58.5 44L55.8 44.8L55 47.5L54.2 44.8L51.5 44L54.2 43.2Z';

// Each sparkle animates in a <span> of its own: Chrome runs that on the GPU,
// while animating an <svg> or a shape inside one redoes the page every frame
// (measured on the Deck: 3 vs 91 style updates a second).
function Glint({d, className}: {d: string; className: string}) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <path d={d} />
      </svg>
    </span>
  );
}

/** A cup with a star, a plinth and a glint, colored by its tier via CSS. */
export function TrophyIcon() {
  return (
    <>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          className="ac-t-handle"
          d="M19 14H11V18C11 25 15 30 21 31M45 14H53V18C53 25 49 30 43 31"
        />
        <path
          className="ac-t-base"
          d="M17 9H47V20C47 31 40.5 38 32 38C23.5 38 17 31 17 20Z"
        />
        <path className="ac-t-shade" d="M32 9H47V20C47 31 40.5 38 32 38Z" />
        <path className="ac-t-shine" d="M22.5 13V20C22.5 26 25 30.5 28 32.5" />
        <rect
          className="ac-t-light"
          x="15"
          y="7"
          width="34"
          height="3.5"
          rx="1.75"
        />
        <path className="ac-t-light ac-t-star" d={STAR} />
        <path className="ac-t-dark" d="M29 38H35L34 44H30Z" />
        <rect
          className="ac-t-base"
          x="24"
          y="44"
          width="16"
          height="4"
          rx="1"
        />
        <rect
          className="ac-t-dark"
          x="20"
          y="48"
          width="24"
          height="8"
          rx="2"
        />
        <rect
          className="ac-t-light"
          x="27"
          y="50.5"
          width="10"
          height="3"
          rx="0.8"
        />
      </svg>
      <Glint d={GLINT} className="ac-glint" />
      <Glint d={GLINT_2} className="ac-glint ac-glint-more ac-glint-2" />
      <Glint d={GLINT_3} className="ac-glint ac-glint-more ac-glint-3" />
    </>
  );
}
