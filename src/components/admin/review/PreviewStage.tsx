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

function frameBox(device: Device, stage: { width: number; height: number }) {
  const width = DEVICE_WIDTH[device];
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
};

/**
 * The preview at the real width a visitor sees, scaled down to fit. A desktop page is laid out at 1440 px, so what the
 * founder judges is the layout the visitor gets, not a squeezed one.
 */
export default function PreviewStage({ frame, previewUrl, businessName, device, pointing, onLoad }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const size = useSize(stage);
  const box = frameBox(device, size);
  return (
    <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden">
      {size.width > 0 && (
        <div
          className={`absolute top-0 left-1/2 overflow-hidden rounded-xl bg-white transition-shadow duration-150 ${pointing ? "shadow-pointing" : "shadow-lifted"}`}
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
          />
        </div>
      )}
    </div>
  );
}
