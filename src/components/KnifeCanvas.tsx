"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { BRUSH_PAINTS } from "@/content/headlines";
import { fitToDisplay, pointIn } from "@/paint/canvas";
import { KnifeBrush } from "@/paint/knifeBrush";
import type { Point } from "@/paint/knifePass";

const KNIFE_WIDTH = 34;

/** Carries the painting over to a resized canvas instead of wiping it. */
function refit(canvas: HTMLCanvasElement) {
  const before = document.createElement("canvas");
  before.width = canvas.width;
  before.height = canvas.height;
  before.getContext("2d")?.drawImage(canvas, 0, 0);
  const context = fitToDisplay(canvas);
  context?.drawImage(before, 0, 0, canvas.width, canvas.height);
}

/**
 * A surface you can drag a loaded palette knife across. Mouse and pen only:
 * on touch screens a drag has to stay a scroll.
 */
export default function KnifeCanvas({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const brush = useRef<KnifeBrush | null>(null);
  const last = useRef<Point | null>(null);

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    fitToDisplay(surface);
    const observer = new ResizeObserver(() => refit(surface));
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const surface = event.currentTarget;
    surface.setPointerCapture(event.pointerId);
    const scale = surface.width / surface.clientWidth;
    brush.current = new KnifeBrush(surface, BRUSH_PAINTS, KNIFE_WIDTH, scale);
    brush.current.begin();
    last.current = pointIn(surface, event.clientX, event.clientY);
  };

  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!brush.current || !last.current) return;
    const point = pointIn(event.currentTarget, event.clientX, event.clientY);
    brush.current.drag(last.current, point);
    last.current = point;
  };

  const stop = () => {
    brush.current = null;
    last.current = null;
  };

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={`cursor-knife ${className}`}
      onPointerDown={start}
      onPointerMove={drag}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}
