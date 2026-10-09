import { useEffect, useRef, type RefObject } from "react";
import { fitToDisplay } from "@/paint/canvas";
import { DripFlow } from "@/paint/dripFlow";
import { KnifePass, play } from "@/paint/knifePass";

/** A painting baked in two parts, so its drips can run after the knife has laid it. */
export type DripLayers = { dry: string; drips: string };

type Options = { ready: boolean; animate: boolean; drips?: DripLayers };

type Run = { cancelled: boolean; stop: () => void };

function showImage(image: HTMLImageElement, visible: boolean) {
  image.style.opacity = visible ? "1" : "0";
}

const loading = new Map<string, Promise<HTMLImageElement>>();

function loaded(source: string): Promise<HTMLImageElement> {
  const existing = loading.get(source);
  if (existing) return existing;
  const image = new Image();
  image.src = source;
  const ready = image.decode().then(() => image);
  loading.set(source, ready);
  return ready;
}

async function playUnlessCancelled(run: Run, animation: KnifePass | DripFlow) {
  if (run.cancelled) return;
  const playing = play(animation);
  run.stop = playing.cancel;
  await playing.done;
}

async function lay(canvas: HTMLCanvasElement, painting: HTMLImageElement, drips: DripLayers | undefined, run: Run) {
  if (!drips) return playUnlessCancelled(run, new KnifePass(canvas, "lay", painting));
  const [dry, layer] = await Promise.all([loaded(drips.dry), loaded(drips.drips)]);
  await playUnlessCancelled(run, new KnifePass(canvas, "lay", dry));
  await playUnlessCancelled(run, new DripFlow(canvas, dry, layer));
}

async function scrape(canvas: HTMLCanvasElement, painting: HTMLImageElement, run: Run) {
  canvas.getContext("2d")?.drawImage(painting, 0, 0, canvas.width, canvas.height);
  await playUnlessCancelled(run, new KnifePass(canvas, "scrape", painting));
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
  { ready, animate, drips }: Options,
) {
  const displayed = useRef(false);

  useEffect(() => {
    const painting = image.current;
    const canvas = surface.current;
    if (!ready || !painting || !canvas || displayed.current === shown) return;
    const previous = displayed.current;
    displayed.current = shown;
    if (!animate) return showImage(painting, shown);

    const run: Run = { cancelled: false, stop: () => {} };
    let finished = false;
    const go = async () => {
      await painting.decode().catch(() => undefined);
      if (run.cancelled) return;
      fitToDisplay(canvas);
      showImage(painting, false);
      await (shown ? lay(canvas, painting, drips, run) : scrape(canvas, painting, run));
      if (run.cancelled) return;
      finished = true;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      showImage(painting, shown);
    };
    void go();

    // An interrupted knife puts things back as they were, so the next run
    // (a scroll the other way, or React re-running the effect) starts clean.
    return () => {
      run.cancelled = true;
      run.stop();
      if (finished) return;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      displayed.current = previous;
      showImage(painting, previous);
    };
  }, [shown, ready, animate, drips, image, surface]);
}
