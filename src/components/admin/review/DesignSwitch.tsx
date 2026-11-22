"use client";

import { ArrowSquareOut, Browser, Layout, SquaresFour } from "@phosphor-icons/react";
import { When } from "../ui";
import Segmented, { type Segment } from "../Segmented";
import type { DesignView, StudioDesign } from "./useDesignView";

function views(design: StudioDesign): Segment<DesignView>[] {
  return [
    { value: "site", label: "Site", icon: Browser },
    { value: "design", label: `Design ${design.letter.toUpperCase()}`, icon: Layout },
    { value: "board", label: "Board", icon: SquaresFour },
  ];
}

type Props = { design: StudioDesign | null; view: DesignView; onView: (view: DesignView) => void };

/** Swaps the stage between the built site and the chosen design it was built from. Shows nothing for a preview built without one. */
export default function DesignSwitch({ design, view, onView }: Props) {
  if (!design) return null;
  return <Segmented label="Compare with the design it was built from" options={views(design)} value={view} onChange={onView} />;
}

/** The stage's address bar: the preview's address, or the design picture's while one shows. */
export const ADDRESS_LINK = "bg-surface shadow-card text-ink-soft hover:text-ink flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-4 text-sm";

/** Where the address bar points while a design picture is on the stage: that picture at full size, named with who chose it. */
export function DesignAddress({ design, src }: { design: StudioDesign; src: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className={ADDRESS_LINK}>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-ink font-medium">{design.name}</span>, chosen by {design.by} <When date={design.at} />
      </span>
      <ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" />
      <span className="sr-only"> (opens the picture full size in a new tab)</span>
    </a>
  );
}

/**
 * On a phone the switch floats under the top bar, over the full-screen preview. With a picture on the stage, a button
 * beside it opens that picture full size, since a phone has no address bar.
 */
export function PhoneDesignBar({ design, view, onView, src }: Props & { src: string | null }) {
  if (!design) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex justify-center px-3 lg:hidden">
      <div className="bg-paper/95 shadow-lifted pointer-events-auto flex items-center rounded-control backdrop-blur">
        <DesignSwitch design={design} view={view} onView={onView} />
        {src && (
          <a href={src} target="_blank" rel="noreferrer" title="Open full size" className="focus-visible:outline-ink grid size-11 shrink-0 place-items-center rounded-control focus-visible:outline-2">
            <ArrowSquareOut size={18} aria-hidden="true" />
            <span className="sr-only">Open this picture full size in a new tab</span>
          </a>
        )}
      </div>
    </div>
  );
}
