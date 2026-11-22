import { EnvelopeSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import { buttonClasses } from "@/components/Button";
import { DisconnectButton, MakeSenderButton } from "@/components/admin/ProjectControls";
import { Card, Notice, SectionHeading, When } from "@/components/admin/ui";
import type { Mailbox } from "@/server/db/schema";

/** What Google's sign-in came back with, as `?mailbox=` on the page it returns to. */
export const MAILBOX_NOTICE: Record<string, { tone: "good" | "bad"; text: string }> = {
  connected: { tone: "good", text: "Inbox connected." },
  failed: { tone: "bad", text: "Google didn't finish connecting the inbox. Try again." },
  "not-configured": { tone: "bad", text: "Add GOOGLE_MAIL_CLIENT_ID and GOOGLE_MAIL_CLIENT_SECRET in Vercel first." },
  "no-refresh-token": { tone: "bad", text: "Google didn't hand over a lasting sign-in. Remove the app's access in that Google account's security settings, then connect again." },
};

function InboxRow({ inbox }: { inbox: Mailbox }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3">
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
      {inbox.lastError && (
        <Notice tone="bad" className="w-full">
          {inbox.lastError}
        </Notice>
      )}
    </li>
  );
}

/** The Gmail inboxes the admin reads and sends from: which one sends outreach, and a way to connect another. */
export default function Inboxes({ inboxes }: { inboxes: Mailbox[] }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionHeading>Inboxes</SectionHeading>
      {inboxes.length === 0 && <p className="text-ink-soft text-sm">No inbox connected</p>}
      <ul className="flex flex-col gap-2">
        {inboxes.map((inbox) => (
          <InboxRow key={inbox.id} inbox={inbox} />
        ))}
      </ul>
      <a href="/api/mailboxes/connect" className={buttonClasses("soft", "sm", "w-fit")}>
        <Plus size={16} weight="bold" aria-hidden="true" />
        Connect a Gmail inbox
      </a>
    </Card>
  );
}
