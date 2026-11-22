"use client";

import { useState } from "react";
import type { BoardPictures } from "@/lib/boards";
import { DEVICE_WIDTH, type Device } from "@/lib/review";
import { DRAWN_AT } from "../designs/parts";
import type { StagePicture } from "./PreviewStage";

/** The chosen design a built preview came from, as the studio shows it next to the preview. */
export type StudioDesign = { letter: string; name: string; by: string; at: Date | null; pictures: BoardPictures };

/** What the stage shows: the built site itself, the chosen design's first screen, or its whole board. */
export type DesignView = "site" | "design" | "board";

function firstScreen(design: StudioDesign, device: Device): Omit<StagePicture, "alt" | "focus"> {
  if (device === "phone") return { src: design.pictures.phone, width: DEVICE_WIDTH.phone };
  return { src: design.pictures.desktop, width: DRAWN_AT.desktop };
}

/**
 * A phone gets the board drawn for a phone when there is one. Otherwise a wide screen fits the whole board to the stage,
 * since it is read as a whole, and a phone scrolls across the wide board.
 */
function wholeBoard(design: StudioDesign, device: Device): Omit<StagePicture, "alt" | "focus"> {
  if (device !== "phone") return { src: design.pictures.board, width: DEVICE_WIDTH[device] };
  if (design.pictures.narrow) return { src: design.pictures.narrow, width: DEVICE_WIDTH.phone };
  return { src: design.pictures.board, width: DRAWN_AT.board };
}

const PICTURE = { design: firstScreen, board: wholeBoard };
const ALT = { design: "first screen", board: "whole board" };

/** The picture over the stage for the view chosen, at the width the preview is shown at. Null while the built site shows. */
export function designPicture(design: StudioDesign | null, view: DesignView, device: Device): StagePicture | null {
  if (!design || view === "site") return null;
  const name = `design ${design.letter.toUpperCase()}, ${design.name}`;
  return { ...PICTURE[view](design, device), alt: `The ${ALT[view]} of ${name}, which this site was built from`, focus: 0 };
}

/** Which view the stage shows, and the picture for it. `flip` swaps the built site and the design's first screen. */
export function useDesignView(design: StudioDesign | null, device: Device) {
  const [view, setView] = useState<DesignView>("site");
  const flip = () => design && setView((current) => (current === "site" ? "design" : "site"));
  return { view, setView, flip, picture: designPicture(design, view, device) };
}
