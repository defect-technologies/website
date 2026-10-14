import type { Icon } from "@phosphor-icons/react";
import { ArrowDownLeft, ArrowUpRight, Hammer, NotePencil, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { actorLabel } from "@/lib/bots";
import { senderName } from "@/lib/senders";
import type { HistoryItem, HistoryKind } from "@/server/sites/siteDetail";
import ShowMore from "./ShowMore";
import { When } from "./ui";

const KIND: Record<HistoryKind, { icon: Icon; className: string; label: string }> = {
  in: { icon: ArrowDownLeft, className: "bg-ink text-paper", label: "They wrote" },
  out: { icon: ArrowUpRight, className: "bg-paper-shade text-ink", label: "We emailed" },
  build: { icon: Hammer, className: "bg-paper-shade text-ink-soft", label: "Build" },
  change: { icon: NotePencil, className: "bg-good/15 text-good", label: "Site change" },
  event: { icon: Sparkle, className: "bg-paper-shade text-ink-soft", label: "Event" },
};

function who(item: HistoryItem) {
  if (item.kind === "out" && !item.who.startsWith("bot:")) return senderName(item.who);
  return item.who === "Them" || !item.who ? item.who : actorLabel(item.who);
}

/** Emails, builds, edits to the live site and everything else that happened, newest first, one icon per kind. */
export default function SiteHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) return <p className="text-ink-faint text-sm">Nothing yet</p>;
  return (
    <ShowMore
      first={25}
      className="flex flex-col gap-4"
      items={items.map((item) => {
        const kind = KIND[item.kind];
        const KindIcon = kind.icon;
        return (
          <li key={item.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
            <span className={`grid size-8 place-items-center rounded-full ${kind.className}`} title={kind.label}>
              <KindIcon size={16} weight="bold" aria-hidden="true" />
              <span className="sr-only">{kind.label}</span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className={`line-clamp-3 text-pretty ${item.kind === "in" ? "whitespace-pre-wrap" : ""}`}>{item.text}</span>
              <span className="text-ink-faint">
                {who(item) ? `${who(item)}, ` : ""}
                <When date={item.at} />
              </span>
            </span>
          </li>
        );
      })}
    />
  );
}
