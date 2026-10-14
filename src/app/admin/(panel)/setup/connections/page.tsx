import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, Clock, EnvelopeSimple, PauseCircle, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import { DisconnectButton, MakeSenderButton } from "@/components/admin/ProjectControls";
import { Card, Notice, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import type { Mailbox } from "@/server/db/schema";
import { healthChecks, type CheckStatus, type HealthCheck } from "@/server/integrations/healthchecks";
import { connectedMailboxes } from "@/server/mail/outbox";

export const metadata: Metadata = { title: "Connections" };

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
  new: { icon: Sparkle, label: "No ping yet", className: "text-ink-faint" },
  paused: { icon: PauseCircle, label: "Paused", className: "text-ink-faint" },
};

function Inboxes({ inboxes }: { inboxes: Mailbox[] }) {
  return (
    <div className="flex flex-col gap-3">
      {inboxes.length === 0 && <p className="text-ink-soft text-sm">No inbox connected</p>}
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
  if (checks.length === 0) return <p className="text-ink-soft text-sm">No checks yet</p>;
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

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ mailbox?: string }> }) {
  const { mailbox } = await searchParams;
  const [inboxes, checks] = await Promise.all([connectedMailboxes(), healthChecks()]);
  const notice = mailbox ? MAILBOX_NOTICE[mailbox] : undefined;

  return (
    <>
      <PageHeader title="Connections" />
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
      </div>
    </>
  );
}
