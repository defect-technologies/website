"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 15_000;

/** Re-reads the page from the server every 15 seconds while the tab is open, so the sheet stays current. */
export default function LiveRefresh({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState(renderedAt);
  const lastAsked = useRef(renderedAt);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (document.visibilityState !== "visible" || current - Math.max(renderedAt, lastAsked.current) < REFRESH_MS) return;
      lastAsked.current = current;
      router.refresh();
    }, 1000);
    return () => window.clearInterval(tick);
  }, [router, renderedAt]);

  const seconds = Math.max(0, Math.round((now - renderedAt) / 1000));
  return <p className="text-ink-faint text-sm tabular-nums">Updated {seconds < 5 ? "just now" : `${seconds}s ago`}</p>;
}
