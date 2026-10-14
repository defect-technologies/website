import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Form from "next/form";
import LeadTools from "@/components/admin/overview/LeadTools";
import LeadsSheet from "@/components/admin/overview/LeadsSheet";
import LiveRefresh from "@/components/admin/overview/LiveRefresh";
import PageTabs, { SITE_TABS } from "@/components/admin/PageTabs";
import { PageHeader } from "@/components/admin/ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { devShortcutsEnabled } from "@/server/env";
import { funnelByArm } from "@/server/leads/businesses";
import { sheetRows, type LeadRow } from "@/server/overview";
import { runnerStatus } from "@/server/runner/status";
import { allClientSites } from "@/server/sites/clientSites";

export const metadata: Metadata = { title: "Sites" };

function parseStatus(status?: string): LeadStatus | null {
  return (LEAD_STATUSES as readonly string[]).includes(status ?? "") ? (status as LeadStatus) : null;
}

function matches(row: LeadRow, query: string) {
  if (!query) return true;
  const { businessName, website, email, ownerEmail, siteUrl, slug } = row.lead;
  return [businessName, website, email, ownerEmail, siteUrl, slug].some((value) => value.toLowerCase().includes(query.toLowerCase()));
}

function Search({ query, status }: { query: string; status: LeadStatus | null }) {
  return (
    <Form action="/admin/sites" className="bg-surface shadow-card focus-within:ring-ink/30 flex min-h-11 w-full max-w-md items-center gap-2 rounded-xl px-3 focus-within:ring-2">
      <MagnifyingGlass size={18} className="text-ink-faint shrink-0" aria-hidden="true" />
      <label htmlFor="sites-q" className="sr-only">
        Filter sites
      </label>
      <input id="sites-q" name="q" type="search" defaultValue={query} placeholder="Name, website or email" className="placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-base outline-none" />
      {status && <input type="hidden" name="status" value={status} />}
    </Form>
  );
}

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const status = parseStatus(params.status);
  const [{ all, readAt }, arms, builds, sites] = await Promise.all([sheetRows(), funnelByArm(), runnerStatus(), allClientSites()]);
  const editors = new Map(sites.flatMap((site) => (site.businessId ? [[site.businessId, site.slug] as const] : [])));
  const abandoned = new Set(builds.abandoned.map((job) => job.id));
  const rows = all.filter((row) => matches(row, query));

  return (
    <>
      <PageHeader title="Sites">
        <LiveRefresh renderedAt={readAt} />
      </PageHeader>
      <PageTabs label="Sites views" tabs={[{ ...SITE_TABS[0], count: all.length }, ...SITE_TABS.slice(1)]} current="/admin/sites" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Search query={query} status={status} />
        <details className="group/tools">
          <summary className="text-ink-soft hover:text-ink flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <CaretRight size={14} weight="bold" className="transition-transform duration-150 group-open/tools:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
            Import leads and price test
          </summary>
          <div className="mt-3">
            <LeadTools arms={arms} samples={devShortcutsEnabled} />
          </div>
        </details>
      </div>
      <LeadsSheet rows={rows} selected={status} ctx={{ editors, abandoned }} query={query} />
    </>
  );
}
