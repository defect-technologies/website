"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { DEVICE_WIDTH, type Device } from "@/lib/review";

/** Phones are shown at a real phone's height when the stage has room. */
const PHONE_HEIGHT = 844;

function useSize(element: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return size;
}

/** Below this stage width the founder is on a phone, so a phone preview fills the stage instead of keeping a phone's size. */
const PHONE_STAGE_WIDTH = 640;

function frameBox(device: Device, stage: { width: number; height: number }) {
  const width = DEVICE_WIDTH[device];
  // On a phone the preview is the phone's own width at full size, so the founder sees exactly what a visitor sees.
  if (device === "phone" && stage.width < PHONE_STAGE_WIDTH) return { width: stage.width, height: stage.height, scale: 1 };
  if (device === "phone") {
    const scale = Math.min(1, stage.height / PHONE_HEIGHT, stage.width / width);
    return { width, height: Math.min(PHONE_HEIGHT, stage.height / scale), scale };
  }
  const scale = Math.min(1, stage.width / width);
  return { width, height: stage.height / scale, scale };
}

type Props = {
  frame: RefObject<HTMLIFrameElement | null>;
  previewUrl: string;
  businessName: string;
  device: Device;
  pointing: boolean;
  onLoad: () => void;
  /** A picture that covers the preview: a repaired note's spot, before or after its repair. */
  picture?: StagePicture | null;
};

/** `width` is the screen width the picture was taken at, and `focus` how far across it the note's element starts (0 to 1). */
export type StagePicture = { src: string; alt: string; width: number; focus: number };

/** A picture wider than the stage is shown at up to twice the stage's width, so its text can still be read. */
const WIDEST_PICTURE = 2;
/** The room left before the element when a wide picture opens on it, so its first letters are not at the very edge. */
const BEFORE_ELEMENT = 16;

/**
 * The picture over the preview. One taken at the stage's own width fits it. One taken at a wider screen (a desktop
 * note looked at on a phone) would shrink to a few pixels a letter, so it is shown larger and scrolls, starting on the
 * element the note points at.
 */
function PictureOverStage({ picture, frameWidth, stageWidth }: { picture: StagePicture; frameWidth: number; stageWidth: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const shownWidth = picture.width > stageWidth ? Math.min(picture.width, frameWidth * WIDEST_PICTURE) : frameWidth;
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = picture.focus * shownWidth - BEFORE_ELEMENT;
  }, [picture.src, picture.focus, shownWidth]);
  return (
    <div ref={scroller} tabIndex={0} role="group" aria-label="Picture of the page" className="bg-paper focus-visible:outline-ink absolute inset-0 overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- the pictures are in the admin's own blob store, as the boards are */}
      <img src={picture.src} alt={picture.alt} className="block max-w-none" style={{ width: shownWidth }} />
    </div>
  );
}

/**
 * The preview at the real width a visitor sees, scaled down to fit. A desktop page is laid out at 1440 px, so what the
 * founder judges is the layout the visitor gets, not a squeezed one.
 */
export default function PreviewStage({ frame, previewUrl, businessName, device, pointing, onLoad, picture = null }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const size = useSize(stage);
  const box = frameBox(device, size);
  return (
    <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden">
      {size.width > 0 && (
        <div
          className={`absolute top-0 left-1/2 overflow-hidden bg-white transition-shadow duration-150 max-lg:rounded-none lg:rounded-xl ${pointing ? "shadow-pointing" : "lg:shadow-lifted"}`}
          style={{ width: box.width * box.scale, height: box.height * box.scale, translate: "-50% 0" }}
        >
          <iframe
            ref={frame}
            src={previewUrl}
            title={`${businessName} preview`}
            onLoad={onLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="origin-top-left border-0"
            style={{ width: box.width, height: box.height, scale: box.scale }}
            inert={Boolean(picture)}
          />
          {picture && <PictureOverStage picture={picture} frameWidth={box.width * box.scale} stageWidth={box.width} />}
        </div>
      )}
    </div>
  );
}
