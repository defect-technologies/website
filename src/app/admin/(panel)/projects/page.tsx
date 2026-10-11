import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, Clock, EnvelopeSimple, PauseCircle, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import FilterBar from "@/components/admin/FilterBar";
import PreviewList, { BUILT_WITHIN, PREVIEW_STATUSES, type PreviewFilters } from "@/components/admin/PreviewList";
import { DisconnectButton, MakeSenderButton } from "@/components/admin/ProjectControls";
import SiteChangeList, { CHANGE_AUTHORS, type ChangeFilters, type SiteInfo } from "@/components/admin/SiteChangeList";
import { Card, Notice, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses, clientSites, type Mailbox } from "@/server/db/schema";
import { healthChecks, type CheckStatus, type HealthCheck } from "@/server/integrations/healthchecks";
import { recentSiteChanges } from "@/server/integrations/siteChanges";
import { previewDeployments } from "@/server/integrations/vercel";
import { connectedMailboxes } from "@/server/mail/outbox";

export const metadata: Metadata = { title: "Projects" };

const MAILBOX_NOTICE: Record<string, { tone: "good" | "bad"; text: string }> = {
  connected: { tone: "good", text: "Inbox connected." },
  failed: { tone: "bad", text: "Google didn't finish connecting the inbox. Try again." },
  "not-configured": { tone: "bad", text: "Add GOOGLE_MAIL_CLIENT_ID and GOOGLE_MAIL_CLIENT_SECRET in Vercel first." },
  "no-refresh-token": { tone: "bad", text: "Google didn't hand over a lasting sign-in. Remove the app's access in that Google account's security settings, then connect again." },
};

const STATUS: Record<CheckStatus, { icon: Icon; label: string; className: string }> = {
  up: { icon: CheckCircle, label: "Up", className: "text-good" },
  down: { icon: WarningCircle, label: "Down", className: "text-bad" },
  grace: { icon: Clock, label: "Late", className: "text-warn" },
  new: { icon: Sparkle, label: "Waiting for its first ping", className: "text-ink-faint" },
  paused: { icon: PauseCircle, label: "Paused", className: "text-ink-faint" },
};

function Inboxes({ inboxes }: { inboxes: Mailbox[] }) {
  return (
    <div className="flex flex-col gap-3">
      {inboxes.length === 0 && <p className="text-ink-soft text-sm">Connect the inbox in Brendan&apos;s name on the sending domain. Outreach goes out from it, and replies are read from it.</p>}
      <ul className="flex flex-col gap-2">
        {inboxes.map((inbox) => (
          <li key={inbox.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EnvelopeSimple size={20} weight={inbox.isSender ? "fill" : "regular"} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {inbox.email}
                  {inbox.isSender && <span className="text-ink-faint font-normal"> sends outreach</span>}
                </p>
                <p className="text-ink-faint text-sm">
                  Last read <When date={inbox.lastSyncedAt} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!inbox.isSender && <MakeSenderButton mailboxId={inbox.id} />}
              <DisconnectButton mailboxId={inbox.id} email={inbox.email} />
            </div>
            {inbox.lastError && <Notice tone="bad" className="w-full">{inbox.lastError}</Notice>}
          </li>
        ))}
      </ul>
      <a href="/api/mailboxes/connect" className={buttonClasses("soft", "sm", "w-fit")}>
        <Plus size={16} weight="bold" aria-hidden="true" />
        Connect a Gmail inbox
      </a>
    </div>
  );
}

function Checks({ checks }: { checks: HealthCheck[] }) {
  if (checks.length === 0) return <p className="text-ink-soft text-sm">No checks on the account yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => {
        const status = STATUS[check.status];
        const StatusIcon = status.icon;
        return (
          <li key={check.key} className="flex items-center gap-3">
            <StatusIcon size={20} weight="fill" className={`shrink-0 ${status.className}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium">{check.name}</span>
            <span className={`text-sm ${status.className}`}>{status.label}</span>
            <span className="text-ink-faint w-28 text-right text-sm">
              <When date={check.lastPing} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Search = { mailbox?: string; pq?: string; pstatus?: string; pdays?: string; cq?: string; cwho?: string; cdays?: string };

const one = (value: string | undefined, allowed?: [string, string][]) => {
  const text = (value ?? "").trim().slice(0, 100);
  return allowed && !allowed.some(([option]) => option === text) ? "" : text;
};

/** Client sites by slug, with the business name and every address their owner might sign in as. */
async function siteDirectory(): Promise<Map<string, SiteInfo>> {
  const database = await db();
  const [leads, sites] = await Promise.all([
    database.select({ id: businesses.id, slug: businesses.slug, name: businesses.businessName, url: businesses.siteUrl, ownerEmail: businesses.ownerEmail, email: businesses.email }).from(businesses),
    database.select().from(clientSites),
  ]);
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

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const previewFilters: PreviewFilters = { q: one(search.pq), status: one(search.pstatus, PREVIEW_STATUSES), days: one(search.pdays, BUILT_WITHIN) };
  const changeFilters: ChangeFilters = { q: one(search.cq), who: one(search.cwho, CHANGE_AUTHORS), days: one(search.cdays, BUILT_WITHIN) };
  const database = await db();
  const [inboxes, checks, previews, leads, siteChanges, sites] = await Promise.all([
    connectedMailboxes(),
    healthChecks(),
    previewDeployments(),
    database.select({ id: businesses.id, slug: businesses.slug, businessName: businesses.businessName, previewUrl: businesses.previewUrl, stage: businesses.stage }).from(businesses),
    recentSiteChanges(Number(changeFilters.days) || null),
    siteDirectory(),
  ]);
  const notice = search.mailbox ? MAILBOX_NOTICE[search.mailbox] : undefined;
  const keepPreviews = { pq: previewFilters.q, pstatus: previewFilters.status, pdays: previewFilters.days };
  const keepChanges = { cq: changeFilters.q, cwho: changeFilters.who, cdays: changeFilters.days };
  const clearPreviews = `/admin/projects?${new URLSearchParams(Object.entries(keepChanges).filter(([, value]) => value))}`;
  const clearChanges = `/admin/projects?${new URLSearchParams(Object.entries(keepPreviews).filter(([, value]) => value))}`;

  return (
    <>
      <PageHeader title="Projects" />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeading>Inboxes</SectionHeading>
          <Inboxes inboxes={inboxes} />
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeading>Health checks</SectionHeading>
          <IntegrationPanel result={checks}>{(data) => <Checks checks={data} />}</IntegrationPanel>
        </Card>
        <Card className="flex flex-col gap-4 p-5" id="previews">
          <SectionHeading>Previews</SectionHeading>
          <IntegrationPanel result={previews}>
            {(data) => (
              <>
                <FilterBar
                  action="/admin/projects"
                  search={{ name: "pq", value: previewFilters.q, placeholder: "Business name", label: "Search previews by business name" }}
                  selects={[
                    { name: "pstatus", label: "Status", value: previewFilters.status, options: PREVIEW_STATUSES },
                    { name: "pdays", label: "Built", value: previewFilters.days, options: BUILT_WITHIN },
                  ]}
                  keep={keepChanges}
                  clearHref={Object.values(keepPreviews).some(Boolean) ? clearPreviews : undefined}
                />
                <PreviewList previews={data} leads={leads} filters={previewFilters} />
              </>
            )}
          </IntegrationPanel>
        </Card>
        <Card className="flex flex-col gap-4 p-5" id="site-changes">
          <SectionHeading>Site changes</SectionHeading>
          <IntegrationPanel result={siteChanges}>
            {(data) => (
              <>
                <FilterBar
                  action="/admin/projects"
                  search={{ name: "cq", value: changeFilters.q, placeholder: "Business name", label: "Search site changes by business name" }}
                  selects={[
                    { name: "cwho", label: "Made by", value: changeFilters.who, options: CHANGE_AUTHORS },
                    { name: "cdays", label: "When", value: changeFilters.days, options: BUILT_WITHIN },
                  ]}
                  keep={keepPreviews}
                  clearHref={Object.values(keepChanges).some(Boolean) ? clearChanges : undefined}
                />
                <SiteChangeList changes={data} sites={sites} filters={changeFilters} />
              </>
            )}
          </IntegrationPanel>
        </Card>
      </div>
    </>
  );
}
