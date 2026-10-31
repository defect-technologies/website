"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFlourish } from "@/hooks/useFlourish";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { flourishLayout, type FlourishLayout } from "@/paint/flourish";

/** Where the strokes' canvas sits against the wordmark, and how far it reaches above and below it. */
type Placement = { layout: FlourishLayout; left: number; top: number; above: number; below: number };

/** Centres the strokes' canvas on the wordmark's painting, which overhangs the text it wraps. */
function placementAround(wrapper: HTMLElement): Placement | null {
  const painting = wrapper.querySelector("img");
  if (!painting) return null;
  const outer = wrapper.getBoundingClientRect();
  const box = painting.getBoundingClientRect();
  const layout = flourishLayout(box.width, document.documentElement.clientWidth);
  const top = box.top - outer.top + box.height / 2 - layout.centre.y;
  return {
    layout,
    left: box.left - outer.left + box.width / 2 - layout.centre.x,
    top,
    above: Math.max(0, -top),
    below: Math.max(0, top + layout.height - wrapper.offsetHeight),
  };
}

function samePlacement(a: Placement | null, b: Placement | null): boolean {
  return a?.left === b?.left && a?.top === b?.top && a?.below === b?.below && a?.layout.width === b?.layout.width && a?.layout.height === b?.layout.height;
}

function usePlacement(wrapperRef: React.RefObject<HTMLDivElement | null>) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      const next = placementAround(wrapper);
      setPlacement((current) => (samePlacement(current, next) ? current : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [wrapperRef]);
  return placement;
}

/** Margins that keep the page's flow clear of the strokes, where the wordmark sits in it rather than over it. */
function roomFor(placement: Placement | null): CSSProperties {
  return placement ? { marginTop: placement.above, marginBottom: placement.below } : {};
}

type WordmarkFlourishProps = {
  shown: boolean;
  /** Set where the wordmark sits in the page's flow, so the text around it moves out of the strokes' way. */
  makeRoom?: boolean;
  children: ReactNode;
};

/** Two knife strokes framing the wordmark, laid after it, dripping, and scraped off with it. */
export default function WordmarkFlourish({ shown, makeRoom = false, children }: WordmarkFlourishProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const placement = usePlacement(wrapper);
  const animate = useMotionAllowed();
  useFlourish(canvas, placement?.layout ?? null, shown, animate);

  return (
    <div ref={wrapper} className="relative" style={makeRoom ? roomFor(placement) : undefined}>
      {placement && (
        <canvas
          ref={canvas}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: placement.left, top: placement.top, width: placement.layout.width, height: placement.layout.height }}
        />
      )}
      {children}
    </div>
  );
}
