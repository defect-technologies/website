import type { ReactNode } from "react";
import KnifeStroke from "./KnifeStroke";

/** A scraped-clean patch of canvas: nothing here yet, and what to do about it. */
export default function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative isolate flex flex-col items-start gap-3 overflow-hidden rounded-2xl px-6 py-10 sm:px-10">
      <KnifeStroke className="text-paper-shade absolute -inset-x-6 top-1/2 -z-10 h-3/4 w-[calc(100%+3rem)] -translate-y-1/2" />
      <p className="text-xl font-semibold">{title}</p>
      {children && <div className="text-ink-soft max-w-prose text-pretty">{children}</div>}
      {action}
    </div>
  );
}
