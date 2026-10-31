import { useCallback, useEffect, useRef, type RefObject } from "react";
import { fitToDisplay } from "@/paint/canvas";
import type { KnifeBrush } from "@/paint/knifeBrush";
import { PaintLayer } from "@/paint/paintLayer";

/** How far down `page` the canvas currently sits, in canvas pixels. */
function offsetIn(page: HTMLElement, canvas: HTMLCanvasElement): number {
  const density = canvas.width / Math.max(1, canvas.clientWidth);
  return Math.round((canvas.getBoundingClientRect().top - page.getBoundingClientRect().top) * density);
}

/**
 * Keeps what is painted on a canvas pinned to the screen fixed to `page`
 * instead, so strokes scroll away with the page. Strokes are painted on the
 * canvas, then handed to a page layer when the knife lifts, and the canvas
 * shows the layer's stretch of the page whenever scrolling moves it.
 * Returns the ref that holds the stroke in progress, and `lift`, which ends it.
 */
export function usePagePaint(canvasRef: RefObject<HTMLCanvasElement | null>, pageRef: RefObject<HTMLElement | null>) {
  const brushRef = useRef<KnifeBrush | null>(null);
  const layerRef = useRef(new PaintLayer());
  const offsetRef = useRef(0);

  const lift = useCallback(() => {
    const area = brushRef.current?.paintedArea();
    brushRef.current = null;
    if (area && canvasRef.current) layerRef.current.absorb(canvasRef.current, area, offsetRef.current);
  }, [canvasRef]);

  useEffect(() => {
    const surface = canvasRef.current;
    const area = pageRef.current;
    if (!surface || !area) return;
    // The knife reads the paint under it, so the canvas stays in memory the CPU can read quickly.
    surface.getContext("2d", { willReadFrequently: true });
    fitToDisplay(surface);

    const show = () => {
      lift();
      offsetRef.current = offsetIn(area, surface);
      const context = surface.getContext("2d");
      if (context) layerRef.current.show(context, offsetRef.current);
    };
    const resize = () => {
      lift();
      const { width, height } = surface;
      fitToDisplay(surface);
      if (surface.width !== width || surface.height !== height) layerRef.current = layerRef.current.resampled(surface.width / width, surface.height / height);
      show();
    };
    let frame = 0;
    const scrolled = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        if (offsetIn(area, surface) !== offsetRef.current) show();
      });
    };

    show();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scrolled);
    };
  }, [canvasRef, pageRef, lift]);

  return { brushRef, lift };
}
