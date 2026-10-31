import { useEffect, useRef, type RefObject } from "react";
import { fitToDisplay } from "@/paint/canvas";
import { FlourishPass, type FlourishLayout } from "@/paint/flourish";
import { KnifePass, PASS_DURATION_MS, play } from "@/paint/knifePass";

/** The strokes go on once the wordmark's own knife has nearly finished. */
const AFTER_WORDMARK_MS = PASS_DURATION_MS - 150;

type Step = "lay" | "scrape" | "finish" | "clear" | "keep";

/** What the canvas should do now, given what it shows and what it is asked to show. */
function nextStep(shown: boolean, animate: boolean, painted: boolean, resized: boolean): Step {
  if (!shown) return animate && painted ? "scrape" : "clear";
  if (!animate || (painted && resized)) return "finish";
  return painted ? "keep" : "lay";
}

function sized(canvas: HTMLCanvasElement): boolean {
  const density = Math.min(window.devicePixelRatio || 1, 2);
  return canvas.width === Math.round(canvas.clientWidth * density) && canvas.height === Math.round(canvas.clientHeight * density);
}

function clear(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

/** Plays a knife pass after `delay`; returns what stops it. A scrape clears what the knife leaves behind once it is done. */
function playLater(canvas: HTMLCanvasElement, pass: () => KnifePass | FlourishPass, delay: number, clearAfter: boolean): () => void {
  let stop = () => {};
  const timer = window.setTimeout(() => {
    const playing = play(pass());
    stop = playing.cancel;
    if (clearAfter) void playing.done.then(() => clear(canvas));
  }, delay);
  return () => {
    window.clearTimeout(timer);
    stop();
  };
}

/**
 * Paints the strokes around the wordmark when `shown` turns true and scrapes
 * them off when it turns false, in step with the wordmark. A resize repaints
 * them at once, finished, instead of playing them again.
 */
export function useFlourish(canvasRef: RefObject<HTMLCanvasElement | null>, layout: FlourishLayout | null, shown: boolean, animate: boolean) {
  const paintedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    // The knife reads the paint under it, so the canvas stays in memory the CPU can read quickly.
    canvas.getContext("2d", { willReadFrequently: true });
    const resized = !sized(canvas);
    if (resized) fitToDisplay(canvas);
    const lay = () => {
      clear(canvas);
      return new FlourishPass(canvas, layout, canvas.width / canvas.clientWidth);
    };
    const step = nextStep(shown, animate, paintedRef.current, resized);
    paintedRef.current = shown;

    if (step === "finish") lay().finish();
    if (step === "clear") clear(canvas);
    if (step === "lay") return playLater(canvas, lay, AFTER_WORDMARK_MS, false);
    if (step === "scrape") return playLater(canvas, () => new KnifePass(canvas, "scrape"), 0, true);
  }, [canvasRef, layout, shown, animate]);
}
