"use client";

import { Fragment, useMemo, useRef, type CSSProperties } from "react";
import { TYPEFACES, paintReach, type Headline } from "@/content/headlines";
import paintings from "@/content/paintings.json";
import { useHydrated } from "@/hooks/useHydrated";
import { useKnifeTransition, type DripLayers } from "@/hooks/useKnifeTransition";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { useSeenOnce } from "@/hooks/useSeenOnce";

type Tag = "h1" | "h2" | "h3" | "p" | "span";

type PaintedHeadlineProps = {
  headline: Headline;
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  /** Drive the knife from outside. Left out, the painting goes on the first time it scrolls into view. */
  shown?: boolean;
};

const FAMILY_CLASS = { display: "font-display", script: "font-script" } as const;

/** Paintings with a band of strokes are baked with their drips apart, so the drips can run once laid. */
function dripLayersFor(id: string): DripLayers {
  return { dry: `/paint/${id}-dry.webp`, drips: `/paint/${id}-drips.webp` };
}

/**
 * The words are real, selectable text set in the same face the painting was
 * made from. Once scripts run they turn transparent and the painting, which
 * overhangs the text by its paint reach, is what you see.
 */
export default function PaintedHeadline({ headline, as: Element = "p", className = "", style, shown }: PaintedHeadlineProps) {
  const root = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const surface = useRef<HTMLCanvasElement>(null);
  const ready = useHydrated();
  const animate = useMotionAllowed();
  const seen = useSeenOnce(root, shown === undefined);
  const face = TYPEFACES[headline.typeface];
  const size = paintings[headline.id as keyof typeof paintings];
  const reach = paintReach(headline);

  const drips = useMemo(() => (headline.band ? dripLayersFor(headline.id) : undefined), [headline]);

  useKnifeTransition(shown ?? seen, image, surface, { ready, animate, drips });

  return (
    <Element
      ref={root as never}
      className={`painted-text relative inline-block w-fit max-w-none whitespace-pre text-left ${FAMILY_CLASS[headline.typeface]} ${className}`}
      style={{ fontWeight: face.weight, lineHeight: face.lineHeight, fontOpticalSizing: "none", "--ink": headline.ink, ...style } as CSSProperties}
    >
      {headline.lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ inset: `-${reach.y}em -${reach.x}em` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a canvas by the knife, so it must be the original file */}
        <img
          ref={image}
          src={`/paint/${headline.id}.webp`}
          width={size?.width}
          height={size?.height}
          alt=""
          decoding="async"
          className="block size-full opacity-0"
        />
        <canvas ref={surface} className="absolute inset-0 size-full" />
      </span>
    </Element>
  );
}
