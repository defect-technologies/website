import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, Clock, EnvelopeSimple, PauseCircle, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import PreviewList from "@/components/admin/PreviewList";
import { DisconnectButton, MakeSenderButton } from "@/components/admin/ProjectControls";
import { Card, Notice, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses, type Mailbox } from "@/server/db/schema";
import { healthChecks, type CheckStatus, type HealthCheck } from "@/server/integrations/healthchecks";
import { recentSiteChanges, type SiteChange } from "@/server/integrations/siteChanges";
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

/** "page:/about" reads as "the /about page". */
function documentName(key: string) {
  if (key === "theme") return "the theme";
  if (key === "modules") return "business details";
  return key.startsWith("page:") ? `the ${key.slice("page:".length)} page` : key;
}

function whoChanged(actor: string) {
  return actor.startsWith("bot:") ? `${actor.slice("bot:".length).replaceAll("-", " ")} bot` : actor;
}

function SiteChanges({ changes }: { changes: SiteChange[] }) {
  if (changes.length === 0) return <p className="text-ink-soft text-sm">No site has been edited yet. Every save by an owner or a bot shows up here.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {changes.map((change) => (
        <li key={change.id} className="flex flex-col gap-0.5 text-sm">
          <span className="text-pretty">
            <span className="font-medium">{change.site}</span>: {change.action} {documentName(change.key)}
          </span>
          <span className="text-ink-faint">
            {whoChanged(change.actor)}, <When date={change.at} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ mailbox?: string }> }) {
  const { mailbox } = await searchParams;
  const database = await db();
  const [inboxes, checks, previews, withPreviews, siteChanges] = await Promise.all([
    connectedMailboxes(),
    healthChecks(),
    previewDeployments(),
    database.select().from(businesses).where(inArray(businesses.stage, ["preview_built", "sent", "clicked", "replied", "lost"])),
    recentSiteChanges(),
  ]);
  const notice = mailbox ? MAILBOX_NOTICE[mailbox] : undefined;

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
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeading>Previews</SectionHeading>
          <IntegrationPanel result={previews}>{(data) => <PreviewList previews={data} leads={withPreviews} />}</IntegrationPanel>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeading>Site changes</SectionHeading>
          <IntegrationPanel result={siteChanges}>{(data) => <SiteChanges changes={data} />}</IntegrationPanel>
        </Card>
      </div>
    </>
  );
}
