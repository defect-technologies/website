import type { Metadata } from "next";
import FilterBar from "@/components/admin/FilterBar";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import PageTabs, { LEAD_TABS } from "@/components/admin/PageTabs";
import PreviewList, { BUILT_WITHIN, PREVIEW_STATUSES, type PreviewFilters } from "@/components/admin/PreviewList";
import { Card, PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { previewDeployments } from "@/server/integrations/vercel";

export const metadata: Metadata = { title: "Previews" };

type Search = { q?: string; status?: string; days?: string };

const one = (value: string | undefined, allowed?: [string, string][]) => {
  const text = (value ?? "").trim().slice(0, 100);
  return allowed && !allowed.some(([option]) => option === text) ? "" : text;
};

export default async function PreviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const filters: PreviewFilters = { q: one(search.q), status: one(search.status, PREVIEW_STATUSES), days: one(search.days, BUILT_WITHIN) };
  const [previews, leads] = await Promise.all([
    previewDeployments(),
    (await db()).select({ id: businesses.id, slug: businesses.slug, businessName: businesses.businessName, previewUrl: businesses.previewUrl, stage: businesses.stage }).from(businesses),
  ]);
  const filtered = Boolean(filters.q || filters.status || filters.days);

  return (
    <>
      <PageHeader title="Leads" />
      <PageTabs label="Leads views" tabs={LEAD_TABS} current="/admin/leads/previews" />
      <Card className="flex flex-col gap-4 p-5">
        <IntegrationPanel result={previews}>
          {(data) => (
            <>
              <FilterBar
                action="/admin/leads/previews"
                search={{ name: "q", value: filters.q, placeholder: "Business name", label: "Search previews by business name" }}
                selects={[
                  { name: "status", label: "Status", value: filters.status, options: PREVIEW_STATUSES },
                  { name: "days", label: "Built", value: filters.days, options: BUILT_WITHIN },
                ]}
                clearHref={filtered ? "/admin/leads/previews" : undefined}
              />
              <PreviewList previews={data} leads={leads} filters={filters} />
            </>
          )}
        </IntegrationPanel>
      </Card>
    </>
  );
}
