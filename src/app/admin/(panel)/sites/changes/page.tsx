import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import FilterBar from "@/components/admin/FilterBar";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import PageTabs, { SITE_TABS } from "@/components/admin/PageTabs";
import { BUILT_WITHIN } from "@/components/admin/PreviewList";
import SiteChangeList, { CHANGE_AUTHORS, type ChangeFilters, type SiteInfo } from "@/components/admin/SiteChangeList";
import { Card, PageHeader } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { recentSiteChanges } from "@/server/integrations/siteChanges";
import { allClientSites, type ClientSiteRow } from "@/server/sites/clientSites";
import { editorEmailsBySite } from "@/server/sites/siteEditors";

export const metadata: Metadata = { title: "Site changes" };

type Search = { q?: string; who?: string; days?: string };

const one = (value: string | undefined, allowed?: [string, string][]) => {
  const text = (value ?? "").trim().slice(0, 100);
  return allowed && !allowed.some(([option]) => option === text) ? "" : text;
};

/** Client sites by slug, with the business name and every address their owner or editors might sign in as. */
async function siteDirectory(sites: ClientSiteRow[]): Promise<Map<string, SiteInfo>> {
  const leads = await (await db())
    .select({ id: businesses.id, slug: businesses.slug, name: businesses.businessName, url: businesses.siteUrl, ownerEmail: businesses.ownerEmail, email: businesses.email })
    .from(businesses);
  const editors = await editorEmailsBySite();
  const directory = new Map<string, SiteInfo>();
  for (const site of sites) {
    const lead = leads.find((candidate) => candidate.id === site.businessId) ?? leads.find((candidate) => candidate.slug === site.slug);
    const clientEmails = [site.ownerEmail, lead?.ownerEmail ?? "", lead?.email ?? "", ...(editors.get(site.id) ?? [])];
    directory.set(site.slug, { name: lead?.name ?? site.slug, url: site.url, ownerEmails: clientEmails.map((email) => email.toLowerCase()).filter(Boolean) });
  }
  for (const lead of leads) {
    if (!directory.has(lead.slug)) directory.set(lead.slug, { name: lead.name, url: lead.url, ownerEmails: [lead.ownerEmail, lead.email].map((email) => email.toLowerCase()).filter(Boolean) });
  }
  return directory;
}

export default async function SiteChangesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const filters: ChangeFilters = { q: one(search.q), who: one(search.who, CHANGE_AUTHORS), days: one(search.days, BUILT_WITHIN) };
  const [sites, changes] = await Promise.all([allClientSites(), recentSiteChanges(Number(filters.days) || null)]);
  const directory = await siteDirectory(sites);
  const filtered = Boolean(filters.q || filters.who || filters.days);

  return (
    <>
      <PageHeader title="Sites">
        <ButtonLink href="/admin/sites/new" size="sm" variant="soft" icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
          Add a live site
        </ButtonLink>
      </PageHeader>
      <PageTabs label="Sites views" tabs={SITE_TABS} current="/admin/sites/changes" />
      <Card className="flex flex-col gap-4 p-5">
          <IntegrationPanel result={changes}>
            {(data) => (
              <>
                <FilterBar
                  action="/admin/sites/changes"
                  search={{ name: "q", value: filters.q, placeholder: "Business name", label: "Search site changes by business name" }}
                  selects={[
                    { name: "who", label: "Made by", value: filters.who, options: CHANGE_AUTHORS },
                    { name: "days", label: "When", value: filters.days, options: BUILT_WITHIN },
                  ]}
                  clearHref={filtered ? "/admin/sites/changes" : undefined}
                />
                <SiteChangeList changes={data} sites={directory} filters={filters} />
              </>
            )}
          </IntegrationPanel>
      </Card>
    </>
  );
}
