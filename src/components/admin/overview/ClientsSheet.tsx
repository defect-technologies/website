import Link from "next/link";
import type { ClientSiteRow } from "@/server/sites/clientSites";
import type { LeadRow } from "@/server/overview";
import OpenEditorButton from "../OpenEditorButton";
import { Cell, EmptyRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { ArmChip, When } from "../ui";
import { LastEmailCell } from "./LeadsSheet";

/** A paying client, its live site, or both: a site added by hand has no lead, and a client mid-launch has no site yet. */
export type ClientRow = { key: string; lead: LeadRow | null; site: ClientSiteRow | null };

const COLUMNS = ["Business", "Site", "Price", "Live since", "Last email", "Editor"];

const hostOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

function Business({ row }: { row: ClientRow }) {
  const name = row.lead?.lead.businessName ?? row.site?.businessName ?? row.site?.slug ?? "";
  if (!row.lead) return <>{name}</>;
  return (
    <Link href={`/admin/leads/${row.lead.lead.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
      {name}
    </Link>
  );
}

function Site({ row }: { row: ClientRow }) {
  if (row.site) {
    return (
      <Link href={`/admin/clients/${row.site.slug}`} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink" title={`Owner: ${row.site.ownerEmail}`}>
        {hostOf(row.site.url)}
      </Link>
    );
  }
  const url = row.lead?.lead.siteUrl;
  return url ? <span className="text-ink-soft">{hostOf(url)}</span> : <span className="text-ink-faint">Not live yet</span>;
}

/** Every client, with the site's page and a one-click way into its editor. */
export default function ClientsSheet({ rows }: { rows: ClientRow[] }) {
  return (
    <Sheet caption="Clients" columns={COLUMNS}>
      <SheetBody>
        {rows.length === 0 && <EmptyRow span={COLUMNS.length}>No clients yet</EmptyRow>}
        {rows.map((row) => (
          <SheetRow key={row.key}>
            <RowHeader className="lg:min-w-48">
              <Business row={row} />
            </RowHeader>
            <Cell label="Site">
              <Site row={row} />
            </Cell>
            <Cell label="Price">
              <ArmChip arm={row.lead?.lead.priceArm ?? null} />
            </Cell>
            <Cell label="Live since" className="whitespace-nowrap">
              <When date={row.lead?.lead.launchedAt ?? row.site?.createdAt ?? null} />
            </Cell>
            <Cell label="Last email">
              <LastEmailCell email={row.lead?.lastEmail ?? null} />
            </Cell>
            <Cell className="lg:text-right">{row.site && <OpenEditorButton slug={row.site.slug} label="Open editor" variant="soft" size="sm" />}</Cell>
          </SheetRow>
        ))}
      </SheetBody>
    </Sheet>
  );
}
