import { Card, Section } from "@/components/admin/ui";
import type { WorkStatus } from "@/lib/designerWork";
import type { DesignerBusiness } from "@/server/designers/work";
import { WorkStatusMark } from "./WorkList";

/** Statuses where the designer has decided and waits on us: designs being drawn, or a site being built. */
const WAITING_ON_US: readonly WorkStatus[] = ["designing", "building", "build_failed"];

/** The designer's businesses we are working on now. Each one comes back to To do once it needs them again. */
export default function InTheWorks({ businesses }: { businesses: DesignerBusiness[] }) {
  const working = businesses.filter((business) => WAITING_ON_US.includes(business.status));
  if (!working.length) return null;
  return (
    <Section title="We're working on these" count={working.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {working.map((business) => (
            <li key={business.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
              <span className="truncate font-medium">{business.businessName}</span>
              <WorkStatusMark status={business.status} />
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
