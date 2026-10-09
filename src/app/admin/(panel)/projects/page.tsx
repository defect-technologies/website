import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, Clock, EnvelopeSimple, PauseCircle, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import { DisconnectButton, MakeSenderButton, SyncPaymentsButton } from "@/components/admin/ProjectControls";
import { Card, Notice, PageHeader, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { db } from "@/server/db/client";
import { businesses, type Business, type Mailbox } from "@/server/db/schema";
import { healthChecks, type CheckStatus, type HealthCheck } from "@/server/integrations/healthchecks";
import { stripeSummary } from "@/server/integrations/stripe";
import { PREVIEW_LIFETIME_DAYS, previewDeployments, type PreviewDeployment } from "@/server/integrations/vercel";
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

function Clients({ clients }: { clients: Business[] }) {
  if (clients.length === 0) return <p className="text-ink-soft text-sm">Nobody has paid yet. When someone checks out, they show up here within half an hour.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {clients.map((client) => (
        <li key={client.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={`/admin/pipeline/${client.id}`} className="font-medium hover:underline">
            {client.businessName}
          </Link>
          <StageChip stage={client.stage} />
          <span className="text-ink-soft text-sm tabular-nums">{client.plan || "Plan unknown"}</span>
          <span className="text-ink-faint ml-auto text-sm">
            {client.siteUrl ? (
              <a href={client.siteUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {client.siteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <>
                Paid <When date={client.paidAt} />, not live yet
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function daysLeft(created: Date) {
  return Math.max(0, PREVIEW_LIFETIME_DAYS - Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

function Previews({ previews, owners }: { previews: PreviewDeployment[]; owners: Map<string, Business> }) {
  if (previews.length === 0) return <p className="text-ink-soft text-sm">No previews deployed.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {previews
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((preview) => {
          const owner = owners.get(preview.url);
          const left = daysLeft(preview.createdAt);
          return (
            <li key={preview.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate">
                {owner ? (
                  <Link href={`/admin/pipeline/${owner.id}`} className="font-medium hover:underline">
                    {owner.businessName}
                  </Link>
                ) : (
                  <span className="text-ink-soft font-mono text-sm">{preview.url.replace("https://", "")}</span>
                )}
              </span>
              <span className={`text-sm tabular-nums ${left <= 5 ? "text-warn font-medium" : "text-ink-faint"}`}>
                {left === 0 ? "Deleted at the next cleanup" : `${left} days left`}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ mailbox?: string }> }) {
  const { mailbox } = await searchParams;
  const database = await db();
  const [inboxes, checks, previews, money, clients, withPreviews] = await Promise.all([
    connectedMailboxes(),
    healthChecks(),
    previewDeployments(),
    stripeSummary(),
    database.select().from(businesses).where(inArray(businesses.stage, ["paid", "live"])),
    database.select().from(businesses).where(inArray(businesses.stage, ["preview_built", "sent", "clicked", "replied", "lost"])),
  ]);
  const owners = new Map(withPreviews.filter((b) => b.previewUrl).map((b) => [b.previewUrl.replace(/\/$/, ""), b]));
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
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SectionHeading count={clients.length}>Clients</SectionHeading>
            <IntegrationPanel result={money}>
              {(data) => (
                <p className="text-sm tabular-nums">
                  <span className="text-xl font-semibold">{dollars.format(data.monthlyRevenue)}</span>
                  <span className="text-ink-faint"> a month from {data.active} subscriptions</span>
                </p>
              )}
            </IntegrationPanel>
          </div>
          <Clients clients={clients} />
          <SyncPaymentsButton />
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeading>Previews</SectionHeading>
          <IntegrationPanel result={previews}>{(data) => <Previews previews={data} owners={owners} />}</IntegrationPanel>
        </Card>
      </div>
    </>
  );
}
