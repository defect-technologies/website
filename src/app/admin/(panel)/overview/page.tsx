import type { Metadata } from "next";
import { CheckMailButton } from "@/components/admin/ThreadControls";
import { PageHeader } from "@/components/admin/ui";
import ActivitySheet from "@/components/admin/overview/ActivitySheet";
import AgentStrip from "@/components/admin/overview/AgentStrip";
import ClientsSheet from "@/components/admin/overview/ClientsSheet";
import ClientsSummary from "@/components/admin/overview/ClientsSummary";
import EmailsSheet from "@/components/admin/overview/EmailsSheet";
import LeadTools from "@/components/admin/overview/LeadTools";
import LeadsSheet from "@/components/admin/overview/LeadsSheet";
import LiveRefresh from "@/components/admin/overview/LiveRefresh";
import SheetTabs, { TABS, type Tab } from "@/components/admin/overview/SheetTabs";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { devShortcutsEnabled } from "@/server/env";
import { overview } from "@/server/overview";

export const metadata: Metadata = { title: "Overview" };

type Params = { tab?: string; status?: string };

function parseTab(tab?: string): Tab {
  return (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "leads";
}

function parseStatus(status?: string): LeadStatus | null {
  return (LEAD_STATUSES as readonly string[]).includes(status ?? "") ? (status as LeadStatus) : null;
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const { agents, leads, clients, emails, activity, runner, money, arms, readAt } = await overview();

  return (
    <>
      <PageHeader title="Overview">
        <LiveRefresh renderedAt={readAt} />
        <CheckMailButton />
      </PageHeader>
      <AgentStrip agents={agents} now={readAt} runner={runner} />
      <section className="flex flex-col gap-4">
        <SheetTabs current={tab} counts={{ leads: leads.length, clients: clients.length }} />
        {tab === "leads" && (
          <>
            <LeadTools arms={arms} samples={devShortcutsEnabled} />
            <LeadsSheet rows={leads} selected={parseStatus(params.status)} />
          </>
        )}
        {tab === "clients" && (
          <>
            <ClientsSummary money={money} />
            <ClientsSheet rows={clients} />
          </>
        )}
        {tab === "emails" && <EmailsSheet rows={emails} />}
        {tab === "activity" && <ActivitySheet rows={activity} />}
      </section>
    </>
  );
}
