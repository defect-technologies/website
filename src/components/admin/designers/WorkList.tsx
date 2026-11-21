import { CalendarX, ChatCircle, CheckCircle, ClockCountdown, CursorClick, Eye, Hammer, Handshake, MinusCircle, PaintBrush, PaperPlaneTilt, Swatches, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Card, Section, StatusMark, type StatusTone, When } from "@/components/admin/ui";
import { WORK_STATUS_LABEL, type WorkStatus } from "@/lib/designerWork";
import { formatCents } from "@/lib/settleUp";
import type { DesignerBusiness } from "@/server/designers/work";

const MARK: Record<WorkStatus, { icon: Icon; tone: StatusTone }> = {
  your_choice: { icon: Swatches, tone: "ink" },
  designing: { icon: PaintBrush, tone: "quiet" },
  building: { icon: Hammer, tone: "quiet" },
  build_failed: { icon: WarningCircle, tone: "bad" },
  your_review: { icon: Eye, tone: "ink" },
  ready_to_send: { icon: CheckCircle, tone: "quiet" },
  sent: { icon: PaperPlaneTilt, tone: "quiet" },
  clicked: { icon: CursorClick, tone: "ink" },
  replied: { icon: ChatCircle, tone: "ink" },
  no_reply: { icon: ClockCountdown, tone: "quiet" },
  said_no: { icon: XCircle, tone: "quiet" },
  client: { icon: Handshake, tone: "good" },
  cancelled: { icon: CalendarX, tone: "quiet" },
  set_aside: { icon: MinusCircle, tone: "quiet" },
};

export function WorkStatusMark({ status }: { status: WorkStatus }) {
  return <StatusMark icon={MARK[status].icon} tone={MARK[status].tone} label={WORK_STATUS_LABEL[status]} />;
}

/** One month of the client's fee, and whether the founders have paid it to the designer yet. */
function Commission({ cents, settled }: { cents: number; settled: boolean }) {
  if (!cents) return null;
  return (
    <span className="flex flex-col items-end">
      <span className={`font-semibold ${settled ? "text-ink-soft" : "text-good"}`}>{formatCents(cents)}</span>
      <span className="text-ink-faint text-sm">{settled ? "Paid" : "Owed"}</span>
    </span>
  );
}

/** How often the business opened the preview from our emails, once they have. Our own clicks never count. */
function Opens({ count }: { count: number }) {
  if (!count) return null;
  return <span className="text-ink-soft text-sm tabular-nums">Opened {count === 1 ? "once" : `${count} times`}</span>;
}

function Row({ business, href, settled }: { business: DesignerBusiness; href: string | null; settled: boolean }) {
  const name = <span className="truncate font-medium">{business.businessName}</span>;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_14rem_7rem]">
      <span className="flex min-w-0 flex-col">
        {href ? (
          <Link href={href} className="focus-visible:outline-ink min-w-0 truncate hover:underline focus-visible:outline-2">
            {name}
          </Link>
        ) : (
          name
        )}
        <span className="text-ink-faint text-sm">
          Taken <When date={business.claimedAt} />
        </span>
      </span>
      <span className="flex flex-col items-start gap-0.5 max-sm:col-span-2 max-sm:row-start-2">
        <WorkStatusMark status={business.status} />
        <Opens count={business.clickCount} />
      </span>
      <span className="text-right tabular-nums max-sm:col-start-2 max-sm:row-start-1">
        <Commission cents={business.earnedCents} settled={settled} />
      </span>
    </li>
  );
}

const PHASES: { title: string; statuses: WorkStatus[] }[] = [
  { title: "Waiting for you", statuses: ["your_choice", "your_review"] },
  { title: "In progress", statuses: ["designing", "building", "build_failed", "ready_to_send"] },
  { title: "Sent to the business", statuses: ["sent", "clicked", "replied", "no_reply", "said_no", "client", "cancelled", "set_aside"] },
];

/**
 * Every design a designer took, grouped by where it is: waiting on them, still being made, or sent. `hrefFor` says
 * where a row opens, or null when it opens nothing. `settled` holds the businesses whose commission was paid.
 */
export default function WorkList({ businesses, hrefFor, settled }: { businesses: DesignerBusiness[]; hrefFor: (business: DesignerBusiness) => string | null; settled: Set<string> }) {
  return (
    <>
      {PHASES.map((phase) => {
        const rows = businesses.filter((business) => phase.statuses.includes(business.status));
        if (!rows.length) return null;
        return (
          <Section key={phase.title} title={phase.title} count={rows.length}>
            <Card>
              <ul className="divide-ink/8 divide-y">
                {rows.map((business) => (
                  <Row key={business.id} business={business} href={hrefFor(business)} settled={settled.has(business.id)} />
                ))}
              </ul>
            </Card>
          </Section>
        );
      })}
    </>
  );
}
