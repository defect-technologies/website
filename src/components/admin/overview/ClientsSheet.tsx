import Link from "next/link";
import type { LeadRow } from "@/server/overview";
import { Cell, EmptyRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { ArmChip, When } from "../ui";
import { LastEmailCell } from "./LeadsSheet";

const COLUMNS = ["Business", "Site", "Plan", "Price", "Live since", "Last email"];

/** Live clients. Client care looks after all of them. */
export default function ClientsSheet({ rows }: { rows: LeadRow[] }) {
  return (
    <Sheet caption="Clients" columns={COLUMNS}>
      <SheetBody>
        {rows.length === 0 && <EmptyRow span={COLUMNS.length}>No live clients yet. A lead lands here when Onboarding puts its site live.</EmptyRow>}
        {rows.map(({ lead, lastEmail }) => (
          <SheetRow key={lead.id}>
            <RowHeader className="lg:min-w-48">
              <Link href={`/admin/pipeline/${lead.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                {lead.businessName}
              </Link>
            </RowHeader>
            <Cell label="Site">
              {lead.siteUrl ? (
                <a href={lead.siteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  {lead.siteUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span className="text-ink-faint">No address</span>
              )}
            </Cell>
            <Cell label="Plan" className="text-ink-soft">
              {lead.plan || "Unknown"}
            </Cell>
            <Cell label="Price">
              <ArmChip arm={lead.priceArm} />
            </Cell>
            <Cell label="Live since" className="whitespace-nowrap">
              <When date={lead.launchedAt} />
            </Cell>
            <Cell label="Last email">
              <LastEmailCell email={lastEmail} />
            </Cell>
          </SheetRow>
        ))}
      </SheetBody>
    </Sheet>
  );
}
