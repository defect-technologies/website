import { requireFounder } from "@/server/auth/session";
import type { Metadata } from "next";
import FilterBar from "@/components/admin/FilterBar";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import PageTabs, { SITE_TABS } from "@/components/admin/PageTabs";
import PreviewList, { BUILT_WITHIN, NO_DESIGNER, PREVIEW_STATUSES, type PreviewFilters } from "@/components/admin/PreviewList";
import { Card, PageHeader } from "@/components/admin/ui";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businesses, designerClaims } from "@/server/db/schema";
import { allDesigners } from "@/server/designers/people";
import { previewDeployments } from "@/server/integrations/vercel";

export const metadata: Metadata = { title: "Previews" };

type Search = { q?: string; status?: string; days?: string; designer?: string };

const one = (value: string | undefined, allowed?: [string, string][]) => {
  const text = (value ?? "").trim().slice(0, 100);
  return allowed && !allowed.some(([option]) => option === text) ? "" : text;
};

export default async function PreviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireFounder();
  const search = await searchParams;
  const designers: [string, string][] = [["", "Any designer"], [NO_DESIGNER, "No designer"], ...(await allDesigners()).map((designer): [string, string] => [designer.id, designer.name])];
  const filters: PreviewFilters = { q: one(search.q), status: one(search.status, PREVIEW_STATUSES), days: one(search.days, BUILT_WITHIN), designer: one(search.designer, designers) };
  const [previews, leads] = await Promise.all([
    previewDeployments(),
    (await db())
      .select({ id: businesses.id, slug: businesses.slug, businessName: businesses.businessName, previewUrl: businesses.previewUrl, stage: businesses.stage, designerId: designerClaims.designerId })
      .from(businesses)
      .leftJoin(designerClaims, eq(designerClaims.businessId, businesses.id)),
  ]);
  const filtered = Boolean(filters.q || filters.status || filters.days || filters.designer);

  return (
    <>
      <PageHeader title="Sites" />
      <PageTabs label="Sites views" tabs={SITE_TABS} current="/admin/sites/previews" />
      <Card className="flex flex-col gap-4 p-5">
        <IntegrationPanel result={previews}>
          {(data) => (
            <>
              <FilterBar
                action="/admin/sites/previews"
                search={{ name: "q", value: filters.q, placeholder: "Business name", label: "Search previews by business name" }}
                selects={[
                  { name: "status", label: "Status", value: filters.status, options: PREVIEW_STATUSES },
                  { name: "days", label: "Built", value: filters.days, options: BUILT_WITHIN },
                  ...(designers.length > 2 ? [{ name: "designer", label: "Designer", value: filters.designer, options: designers }] : []),
                ]}
                clearHref={filtered ? "/admin/sites/previews" : undefined}
              />
              <PreviewList previews={data} leads={leads} filters={filters} />
            </>
          )}
        </IntegrationPanel>
      </Card>
    </>
  );
}
