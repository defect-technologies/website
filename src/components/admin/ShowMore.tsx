import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

/**
 * A list that shows its first few items and folds the rest behind "Show N more".
 * Each item must be an <li>. Rendered on the server; opening it needs no request.
 */
export default function ShowMore({ items, first = 10, className = "flex flex-col gap-3" }: { items: ReactNode[]; first?: number; className?: string }) {
  const rest = items.slice(first);
  return (
    <div className="flex flex-col gap-3">
      <ul className={className}>{items.slice(0, first)}</ul>
      {rest.length > 0 && (
        <details className="group/more">
          <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <CaretRight size={14} className="transition-transform duration-150 group-open/more:rotate-90" aria-hidden="true" />
            <span className="group-open/more:hidden">Show {rest.length} more</span>
            <span className="hidden group-open/more:inline">Show fewer</span>
          </summary>
          <ul className={`mt-3 ${className}`}>{rest}</ul>
        </details>
      )}
    </div>
  );
}
