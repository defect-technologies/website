"use client";

import { useRef, type PointerEvent, type RefObject } from "react";
import { BRUSH_PAINTS } from "@/content/headlines";
import { usePagePaint } from "@/hooks/usePagePaint";
import { pointIn } from "@/paint/canvas";
import { KnifeBrush } from "@/paint/knifeBrush";

const KNIFE_WIDTH = 34;

type KnifeCanvasProps = {
  /** What the paint is laid on: it scrolls with this element while the canvas stays on screen. */
  page: RefObject<HTMLElement | null>;
  className?: string;
};

/**
 * A surface you can drag a loaded palette knife across. Mouse and pen only:
 * on touch screens a drag has to stay a scroll.
 */
export default function KnifeCanvas({ page, className = "" }: KnifeCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { brushRef, lift } = usePagePaint(canvas, page);

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const surface = event.currentTarget;
    surface.setPointerCapture(event.pointerId);
    lift();
    const scale = surface.width / surface.clientWidth;
    brushRef.current = new KnifeBrush(surface, BRUSH_PAINTS, KNIFE_WIDTH, scale, pointIn(surface, event.clientX, event.clientY));
  };

  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    const brush = brushRef.current;
    if (!brush) return;
    const surface = event.currentTarget;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const moves = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    brush.drag(moves.map((move) => pointIn(surface, move.clientX, move.clientY)));
  };

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={`cursor-knife ${className}`}
      onPointerDown={start}
      onPointerMove={drag}
      onPointerUp={lift}
      onPointerCancel={lift}
    />
  );
}
