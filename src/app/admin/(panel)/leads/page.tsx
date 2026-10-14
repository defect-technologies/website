import type { Metadata } from "next";
import LeadTools from "@/components/admin/overview/LeadTools";
import LeadsSheet from "@/components/admin/overview/LeadsSheet";
import LiveRefresh from "@/components/admin/overview/LiveRefresh";
import PageTabs, { LEAD_TABS } from "@/components/admin/PageTabs";
import { PageHeader } from "@/components/admin/ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { devShortcutsEnabled } from "@/server/env";
import { funnelByArm } from "@/server/leads/businesses";
import { sheetRows } from "@/server/overview";

export const metadata: Metadata = { title: "Leads" };

function parseStatus(status?: string): LeadStatus | null {
  return (LEAD_STATUSES as readonly string[]).includes(status ?? "") ? (status as LeadStatus) : null;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [{ leads, readAt }, arms] = await Promise.all([sheetRows(), funnelByArm()]);

  return (
    <>
      <PageHeader title="Leads">
        <LiveRefresh renderedAt={readAt} />
      </PageHeader>
      <PageTabs label="Leads views" tabs={[{ ...LEAD_TABS[0], count: leads.length }, LEAD_TABS[1]]} current="/admin/leads" />
      <LeadTools arms={arms} samples={devShortcutsEnabled} />
      <LeadsSheet rows={leads} selected={parseStatus(status)} now={readAt} />
    </>
  );
}
