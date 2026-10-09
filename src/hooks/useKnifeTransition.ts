import { useEffect, useRef, type RefObject } from "react";
import { KnifePass, playPass } from "@/paint/knifePass";
import { fitToDisplay } from "@/paint/canvas";

function showImage(image: HTMLImageElement, visible: boolean) {
  image.style.opacity = visible ? "1" : "0";
}

/**
 * Lays a painting in with a palette knife when `shown` turns true and scrapes
 * it off when it turns false. The knife works on a canvas over the image; the
 * image itself only becomes visible once the knife has finished.
 */
export function useKnifeTransition(
  shown: boolean,
  image: RefObject<HTMLImageElement | null>,
  surface: RefObject<HTMLCanvasElement | null>,
  options: { ready: boolean; animate: boolean },
) {
  const displayed = useRef(false);
  const { ready, animate } = options;

  useEffect(() => {
    const painting = image.current;
    const canvas = surface.current;
    if (!ready || !painting || !canvas || displayed.current === shown) return;
    const previous = displayed.current;
    displayed.current = shown;
    if (!animate) return showImage(painting, shown);

    let cancelled = false;
    let finished = false;
    let stop = () => {};
    const run = async () => {
      await painting.decode().catch(() => undefined);
      if (cancelled) return;
      const context = fitToDisplay(canvas);
      if (!shown) context?.drawImage(painting, 0, 0, canvas.width, canvas.height);
      showImage(painting, false);
      const pass = playPass(new KnifePass(canvas, shown ? "lay" : "scrape", painting));
      stop = pass.cancel;
      await pass.done;
      if (cancelled) return;
      finished = true;
      context?.clearRect(0, 0, canvas.width, canvas.height);
      showImage(painting, shown);
    };
    void run();

    // An interrupted knife puts things back as they were, so the next run
    // (a scroll the other way, or React re-running the effect) starts clean.
    return () => {
      cancelled = true;
      stop();
      if (finished) return;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      displayed.current = previous;
      showImage(painting, previous);
    };
  }, [shown, ready, animate, image, surface]);
}
