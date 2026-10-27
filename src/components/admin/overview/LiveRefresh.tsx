"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 15_000;
// A tab left open and visible re-read the database every 15 seconds all day, which kept Neon from ever sleeping. It
// refreshes only while someone has used the page in the last 10 minutes; any click, key or scroll starts it again.
const ATTENDED_MS = 10 * 60_000;

/** Re-reads the page from the server every 15 seconds while the tab is open and in use, so the sheet stays current. */
export default function LiveRefresh({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState(renderedAt);
  const lastAsked = useRef(renderedAt);
  const lastUsed = useRef(renderedAt);

  useEffect(() => {
    const used = () => {
      lastUsed.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "focus"] as const;
    for (const name of events) window.addEventListener(name, used, { passive: true });
    return () => {
      for (const name of events) window.removeEventListener(name, used);
    };
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (document.visibilityState !== "visible" || current - lastUsed.current > ATTENDED_MS) return;
      if (current - Math.max(renderedAt, lastAsked.current) < REFRESH_MS) return;
      lastAsked.current = current;
      router.refresh();
    }, 1000);
    return () => window.clearInterval(tick);
  }, [router, renderedAt]);

  const seconds = Math.max(0, Math.round((now - renderedAt) / 1000));
  return <p className="text-ink-faint text-sm tabular-nums">Updated {seconds < 5 ? "just now" : `${seconds}s ago`}</p>;
}
