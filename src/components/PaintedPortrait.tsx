"use client";

import { useRef } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { useKnifeTransition } from "@/hooks/useKnifeTransition";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { useSeenOnce } from "@/hooks/useSeenOnce";

const SIZE = 1200;

/** A portrait painted straight onto the page, laid in with the knife the first time it comes into view. */
export default function PaintedPortrait({ src, alt }: { src: string; alt: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const surface = useRef<HTMLCanvasElement>(null);
  const ready = useHydrated();
  const animate = useMotionAllowed();
  const seen = useSeenOnce(frame, ready);

  useKnifeTransition(seen, image, surface, { ready, animate });

  return (
    <div ref={frame} className="relative aspect-square w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a canvas by the knife, so it must be the original file */}
      <img ref={image} src={src} alt={alt} width={SIZE} height={SIZE} className="block size-full opacity-0" />
      <canvas ref={surface} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
    </div>
  );
}
