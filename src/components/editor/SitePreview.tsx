"use client";

import { Desktop, DeviceMobile, type Icon } from "@phosphor-icons/react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { renderSite } from "@/lib/renderSite";
import type { SiteContent } from "@/lib/siteContent";

type Width = "desktop" | "phone";

const WIDTHS: { value: Width; label: string; icon: Icon }[] = [
  { value: "desktop", label: "Computer", icon: Desktop },
  { value: "phone", label: "Phone", icon: DeviceMobile },
];

function WidthSwitch({ width, onChange }: { width: Width; onChange: (width: Width) => void }) {
  return (
    <div role="group" aria-label="Preview size" className="bg-paper-shade flex rounded-full p-1">
      {WIDTHS.map(({ value, label, icon: WidthIcon }) => {
        const selected = width === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${selected ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}
          >
            <WidthIcon size={16} weight={selected ? "fill" : "regular"} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** The owner's site as visitors will see it, re-rendered from the draft on every change. */
export default function SitePreview({ content, assetBaseUrl, liveUrl }: { content: SiteContent; assetBaseUrl: string; liveUrl: string }) {
  const [width, setWidth] = useState<Width>("desktop");
  const deferred = useDeferredValue(content);
  const html = useMemo(() => renderSite(deferred, { assetBaseUrl: assetBaseUrl || undefined, editorPreview: true }), [deferred, assetBaseUrl]);
  const frame = useRef<HTMLIFrameElement>(null);
  const scrollY = useRef(0);

  useEffect(() => {
    const remember = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && typeof event.data?.previewScrollY === "number") scrollY.current = event.data.previewScrollY;
    };
    addEventListener("message", remember);
    return () => removeEventListener("message", remember);
  }, []);

  const restoreScroll = () => frame.current?.contentWindow?.postMessage({ restoreScrollY: scrollY.current }, "*");

  return (
    <section aria-labelledby="preview-title" className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-title" className="text-lg font-semibold">
          Preview
        </h2>
        <WidthSwitch width={width} onChange={setWidth} />
      </div>
      <div className="bg-paper-shade flex min-h-0 flex-1 justify-center overflow-hidden rounded-2xl p-2">
        <iframe
          ref={frame}
          title={`Preview of ${content.business.name}${liveUrl ? `, live at ${liveUrl}` : ""}`}
          srcDoc={html}
          sandbox="allow-scripts"
          onLoad={restoreScroll}
          className={`bg-surface shadow-card h-full min-h-[32rem] rounded-xl transition-[width] duration-300 ease-knife motion-reduce:transition-none ${width === "phone" ? "w-[390px] max-w-full" : "w-full"}`}
        />
      </div>
    </section>
  );
}
