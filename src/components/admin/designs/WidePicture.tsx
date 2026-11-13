import { BoardPicture } from "./parts";

/**
 * A picture made for a wide screen, on whatever screen the founder has. Where it fits it is shown whole. On a narrow
 * screen it would shrink until its text can't be read, so it is shown at up to twice the screen's width and scrolls
 * sideways. `madeAt` is the width in pixels the picture was drawn at.
 */
export default function WidePicture({ src, alt, madeAt }: { src: string; alt: string; madeAt: number }) {
  return (
    <div tabIndex={0} role="group" aria-label={alt} className="focus-visible:outline-ink overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2">
      <BoardPicture src={src} alt={alt} className="max-w-none" style={{ width: `min(${madeAt}px, 200%)`, minWidth: "100%" }} />
    </div>
  );
}
