import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import FilterBar from "@/components/admin/FilterBar";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import ClientsSheet, { type ClientRow } from "@/components/admin/overview/ClientsSheet";
import { BUILT_WITHIN } from "@/components/admin/PreviewList";
import SiteChangeList, { CHANGE_AUTHORS, type ChangeFilters, type SiteInfo } from "@/components/admin/SiteChangeList";
import { Card, PageHeader, Section } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { recentSiteChanges } from "@/server/integrations/siteChanges";
import { sheetRows, type LeadRow } from "@/server/overview";
import { allClientSites, type ClientSiteRow } from "@/server/sites/clientSites";

export const metadata: Metadata = { title: "Clients" };

type Search = { q?: string; who?: string; days?: string };

const one = (value: string | undefined, allowed?: [string, string][]) => {
  const text = (value ?? "").trim().slice(0, 100);
  return allowed && !allowed.some(([option]) => option === text) ? "" : text;
};

/** Live clients joined to their sites by lead, or by slug for sites added before leads were linked. */
function clientRows(clients: LeadRow[], sites: ClientSiteRow[]): ClientRow[] {
  const used = new Set<string>();
  const rows = clients.map((lead): ClientRow => {
    const site = sites.find((candidate) => candidate.businessId === lead.lead.id) ?? sites.find((candidate) => candidate.slug === lead.lead.slug) ?? null;
    if (site) used.add(site.slug);
    return { key: lead.lead.id, lead, site };
  });
  const unlinked = sites.filter((site) => !used.has(site.slug)).map((site): ClientRow => ({ key: site.slug, lead: null, site }));
  return [...rows, ...unlinked];
}

/** Client sites by slug, with the business name and every address their owner might sign in as. */
async function siteDirectory(sites: ClientSiteRow[]): Promise<Map<string, SiteInfo>> {
  const leads = await (await db())
    .select({ id: businesses.id, slug: businesses.slug, name: businesses.businessName, url: businesses.siteUrl, ownerEmail: businesses.ownerEmail, email: businesses.email })
    .from(businesses);
  const directory = new Map<string, SiteInfo>();
  for (const site of sites) {
    const lead = leads.find((candidate) => candidate.id === site.businessId) ?? leads.find((candidate) => candidate.slug === site.slug);
    directory.set(site.slug, { name: lead?.name ?? site.slug, url: site.url, ownerEmails: [site.ownerEmail, lead?.ownerEmail ?? "", lead?.email ?? ""].map((email) => email.toLowerCase()).filter(Boolean) });
  }
  for (const lead of leads) {
    if (!directory.has(lead.slug)) directory.set(lead.slug, { name: lead.name, url: lead.url, ownerEmails: [lead.ownerEmail, lead.email].map((email) => email.toLowerCase()).filter(Boolean) });
  }
  return directory;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const filters: ChangeFilters = { q: one(search.q), who: one(search.who, CHANGE_AUTHORS), days: one(search.days, BUILT_WITHIN) };
  const [{ clients }, sites, changes] = await Promise.all([sheetRows(), allClientSites(), recentSiteChanges(Number(filters.days) || null)]);
  const directory = await siteDirectory(sites);
  const filtered = Boolean(filters.q || filters.who || filters.days);

  return (
    <>
      <PageHeader title="Clients">
        <ButtonLink href="/admin/clients/new" size="sm" variant="soft" icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
          Add a site
        </ButtonLink>
      </PageHeader>
      <ClientsSheet rows={clientRows(clients, sites)} />
      <Section id="site-changes" title="Site changes">
        <Card className="flex flex-col gap-4 p-5">
          <IntegrationPanel result={changes}>
            {(data) => (
              <>
                <FilterBar
                  action="/admin/clients"
                  search={{ name: "q", value: filters.q, placeholder: "Business name", label: "Search site changes by business name" }}
                  selects={[
                    { name: "who", label: "Made by", value: filters.who, options: CHANGE_AUTHORS },
                    { name: "days", label: "When", value: filters.days, options: BUILT_WITHIN },
                  ]}
                  clearHref={filtered ? "/admin/clients#site-changes" : undefined}
                />
                <SiteChangeList changes={data} sites={directory} filters={filters} />
              </>
            )}
          </IntegrationPanel>
        </Card>
      </Section>
    </>
  );
}
