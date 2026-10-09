"use client";

import { ArrowCounterClockwise, Knife } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { useSeenOnce } from "@/hooks/useSeenOnce";
import { fitToDisplay, pointIn } from "@/paint/canvas";
import { KnifePass, playPass, scrapeAlong, type Point } from "@/paint/knifePass";
import { Button } from "./Button";

type ScrapeRevealProps = {
  painted: string;
  revealed: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
};

const SCRAPER_WIDTH = 46;

function loadedImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = source;
  return image.decode().then(() => image);
}

/** Paints the canvas back, with the knife when motion is allowed. */
async function layPainting(canvas: HTMLCanvasElement, painting: HTMLImageElement, animate: boolean) {
  const context = fitToDisplay(canvas);
  if (!animate) return context?.drawImage(painting, 0, 0, canvas.width, canvas.height);
  await playPass(new KnifePass(canvas, "lay", painting, -0.5)).done;
  context?.drawImage(painting, 0, 0, canvas.width, canvas.height);
}

async function scrapeAll(canvas: HTMLCanvasElement, animate: boolean) {
  if (animate) await playPass(new KnifePass(canvas, "scrape", null, -0.5)).done;
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * A palette knife painting laid over the real thing. Drag across it, or use
 * the button, to scrape the paint off and see what is underneath.
 */
export default function ScrapeReveal({ painted, revealed, width, height, alt, className = "" }: ScrapeRevealProps) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const painting = useRef<HTMLImageElement | null>(null);
  const last = useRef<Point | null>(null);
  const [scraped, setScraped] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const animate = useMotionAllowed();
  const seen = useSeenOnce(frame, ready);

  useEffect(() => {
    const surface = canvas.current;
    if (!seen || !surface) return;
    let cancelled = false;
    void loadedImage(painted).then((image) => {
      if (cancelled) return;
      painting.current = image;
      void layPainting(surface, image, animate);
    });
    return () => {
      cancelled = true;
    };
  }, [seen, painted, animate]);

  const toggle = async () => {
    const surface = canvas.current;
    if (!surface || !painting.current || busy) return;
    setBusy(true);
    if (scraped) await layPainting(surface, painting.current, animate);
    else await scrapeAll(surface, animate);
    setScraped(!scraped);
    setBusy(false);
  };

  const startScrape = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = pointIn(event.currentTarget, event.clientX, event.clientY);
  };

  const scrape = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const surface = event.currentTarget;
    const point = pointIn(surface, event.clientX, event.clientY);
    scrapeAlong(surface, last.current, point, SCRAPER_WIDTH * (surface.width / surface.clientWidth));
    last.current = point;
    if (!scraped) setScraped(true);
  };

  const stopScrape = () => {
    last.current = null;
  };

  return (
    <div className={`flex flex-col items-start gap-4 ${className}`}>
      <div ref={frame} className="relative w-full overflow-hidden rounded-2xl shadow-lifted" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- sized by its frame, and the painting above it must line up pixel for pixel */}
        <img src={revealed} alt={alt} width={width} height={height} className="block size-full object-cover" />
        <canvas
          ref={canvas}
          aria-hidden="true"
          className="cursor-knife absolute inset-0 size-full touch-pan-y"
          onPointerDown={startScrape}
          onPointerMove={scrape}
          onPointerUp={stopScrape}
          onPointerCancel={stopScrape}
        />
      </div>
      <Button
        onClick={toggle}
        disabled={!seen || busy}
        icon={scraped ? <ArrowCounterClockwise size={20} weight="bold" aria-hidden="true" /> : <Knife size={20} weight="bold" aria-hidden="true" />}
      >
        {scraped ? "Paint it back" : "Scrape off the paint"}
      </Button>
    </div>
  );
}
