"use client";

import { useState } from "react";
import type { QueueItem } from "@/server/outreach/queue";
import QueueCard from "./QueueCard";

const keyOf = (item: QueueItem) => `${item.kind}-${item.business.id}`;

/**
 * Keeps the order the queue had when the page loaded. A sent or skipped card
 * stays where it was, showing what happened (and Undo), even after a refresh
 * drops it from the server's list. New items are added at the end.
 */
export default function QueueList({ items, limitReached }: { items: QueueItem[]; limitReached: boolean }) {
  const [firstSeen] = useState(items);
  const current = new Map(items.map((item) => [keyOf(item), item]));
  const known = new Set(firstSeen.map(keyOf));
  const shown = [...firstSeen.map((item) => current.get(keyOf(item)) ?? item), ...items.filter((item) => !known.has(keyOf(item)))];

  return (
    <ol className="flex flex-col gap-4">
      {shown.map((item) => (
        <li key={keyOf(item)}>
          <QueueCard
            business={item.business}
            kind={item.kind}
            subject={item.subject}
            template={item.template}
            values={item.values}
            blockers={item.blockers}
            limitReached={limitReached}
          />
        </li>
      ))}
    </ol>
  );
}
