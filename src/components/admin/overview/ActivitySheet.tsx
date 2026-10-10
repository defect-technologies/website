import Link from "next/link";
import { actorLabel } from "@/lib/bots";
import type { ActivityRow } from "@/server/overview";
import { Cell, EmptyRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { When } from "../ui";

const COLUMNS = ["When", "Who", "Business", "What happened"];

const PRIORITY_TONE: Record<string, string> = { urgent: "bg-bad text-paper", review: "bg-warn/15 text-warn", fyi: "bg-paper-shade text-ink-soft" };
const PRIORITY_LABEL: Record<string, string> = { urgent: "Urgent", review: "Review", fyi: "FYI" };

/** Everything founders, bots, the runner and the mail sync did, newest first. */
export default function ActivitySheet({ rows }: { rows: ActivityRow[] }) {
  return (
    <Sheet caption="Activity" columns={COLUMNS}>
      <SheetBody>
        {rows.length === 0 && <EmptyRow span={COLUMNS.length}>Nothing has happened yet.</EmptyRow>}
        {rows.map((entry) => (
          <SheetRow key={entry.id}>
            <Cell className="text-ink-faint whitespace-nowrap">
              <When date={entry.at} />
            </Cell>
            <RowHeader className="whitespace-nowrap">{actorLabel(entry.actor)}</RowHeader>
            <Cell label="Lead" className="lg:min-w-40">
              {entry.businessId ? (
                <Link href={`/admin/pipeline/${entry.businessId}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                  {entry.businessName}
                </Link>
              ) : (
                <span className="text-ink-faint">None</span>
              )}
            </Cell>
            <Cell className="lg:min-w-80">
              <span className="flex flex-wrap items-baseline gap-x-2">
                {entry.priority && <span className={`rounded-full px-2 text-sm font-medium ${PRIORITY_TONE[entry.priority] ?? PRIORITY_TONE.fyi}`}>{PRIORITY_LABEL[entry.priority] ?? entry.priority}</span>}
                <span className="font-medium">{entry.action}</span>
                {entry.detail && <span className="text-ink-soft line-clamp-2">{entry.detail}</span>}
              </span>
            </Cell>
          </SheetRow>
        ))}
      </SheetBody>
    </Sheet>
  );
}
