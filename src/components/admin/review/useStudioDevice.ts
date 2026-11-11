"use client";

import { useState } from "react";
import type { Device } from "@/lib/review";

const isWideScreen = () => window.matchMedia("(width >= 64rem)").matches;

/**
 * The width the preview is shown at. A phone-sized screen starts on phone and a wide one on desktop. On a wide screen a
 * critic's proposal shows at the width its critic looked at, until the founder picks another width for that question.
 */
export function useStudioDevice(proposalDevice: Device | null, askId: string | null) {
  const [chosen, setChosen] = useState<Device>(() => (isWideScreen() ? "desktop" : "phone"));
  const [pinned, setPinned] = useState<{ askId: string | null; device: Device } | null>(null);
  const proposed = proposalDevice && isWideScreen() ? proposalDevice : null;
  const device = pinned && pinned.askId === askId ? pinned.device : (proposed ?? chosen);
  const choose = (next: Device) => {
    setChosen(next);
    setPinned({ askId, device: next });
  };
  return [device, choose] as const;
}
