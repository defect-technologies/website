"use client";

import { CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { QueueItem } from "@/server/outreach/queue";
import QueueCard from "./QueueCard";
import { ArmChip } from "./ui";

const keyOf = (item: QueueItem) => `${item.kind}-${item.business.id}`;

/**
 * Keeps the order the queue had when the page loaded. A sent or skipped card
 * stays where it was, showing what happened (and Undo), even after a refresh
 * drops it from the server's list. New items are added at the end. Only the
 * first is open: the rest fold to one line each, so the queue reads one at a time.
 */
/** A queued email folded to one line: who it's for, the price, and whether something blocks it. Opening it shows the whole card. */
function Folded({ item, children }: { item: QueueItem; children: React.ReactNode }) {
  return (
    <details className="group/fold">
      <summary className="bg-surface shadow-card hover:bg-paper/70 flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-5 py-3 group-open/fold:hidden [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} weight="bold" className="text-ink-faint" aria-hidden="true" />
        <span className="font-semibold">{item.business.businessName}</span>
        <ArmChip arm={item.business.priceArm} />
        <span className="text-ink-faint min-w-0 flex-1 truncate text-sm">{item.business.email || "No address yet"}</span>
        {item.blockers.length > 0 && (
          <span className="text-warn inline-flex items-center gap-1.5 text-sm font-medium" title={item.blockers.join(" ")}>
            <WarningCircle size={16} weight="fill" aria-hidden="true" />
            {item.blockers.length === 1 ? "1 fix" : `${item.blockers.length} fixes`}
          </span>
        )}
      </summary>
      {children}
    </details>
  );
}

export default function QueueList({ items, limitReached }: { items: QueueItem[]; limitReached: boolean }) {
  const [firstSeen] = useState(items);
  const current = new Map(items.map((item) => [keyOf(item), item]));
  const known = new Set(firstSeen.map(keyOf));
  const shown = [...firstSeen.map((item) => current.get(keyOf(item)) ?? item), ...items.filter((item) => !known.has(keyOf(item)))];

  return (
    <ol className="flex flex-col gap-4">
      {shown.map((item, index) => {
        const card = (
          <QueueCard
            business={item.business}
            kind={item.kind}
            subject={item.subject}
            template={item.template}
            values={item.values}
            blockers={item.blockers}
            editBlockers={item.editBlockers}
            limitReached={limitReached}
          />
        );
        return <li key={keyOf(item)}>{index === 0 ? card : <Folded item={item}>{card}</Folded>}</li>;
      })}
    </ol>
  );
}
