import type { Icon } from "@phosphor-icons/react";
import { ChatsCircle, CircleDashed, Clock, HourglassMedium, PaperPlaneTilt, WarningCircle, Wrench, XCircle } from "@phosphor-icons/react/dist/ssr";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/leadStatus";
import WorkingDot from "./WorkingDot";

const MARK: Record<Exclude<LeadStatus, "building">, { icon: Icon; className: string }> = {
  not_queued: { icon: CircleDashed, className: "text-ink-faint" },
  queued: { icon: HourglassMedium, className: "text-ink-soft" },
  build_failed: { icon: WarningCircle, className: "text-bad" },
  ready_to_send: { icon: PaperPlaneTilt, className: "text-ink" },
  waiting: { icon: Clock, className: "text-ink-soft" },
  negotiating: { icon: ChatsCircle, className: "text-ink" },
  setting_up: { icon: Wrench, className: "text-good" },
  closed: { icon: XCircle, className: "text-ink-faint" },
};

/** A lead status as an icon and its name. Building gets the live dot every working thing on the Overview shares. */
export default function LeadStatusMark({ status }: { status: LeadStatus }) {
  if (status === "building") {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="flex size-4 items-center justify-center">
          <WorkingDot />
        </span>
        {LEAD_STATUS_LABEL.building}
      </span>
    );
  }
  const { icon: MarkIcon, className } = MARK[status];
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${className}`}>
      <MarkIcon size={16} weight="bold" aria-hidden="true" />
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}
