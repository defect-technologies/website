import "server-only";
import { randomUUID } from "node:crypto";
import { asc, desc } from "drizzle-orm";
import { db } from "../db/client";
import { mailboxes, type Mailbox } from "../db/schema";
import { devShortcutsEnabled } from "../env";
import { sendEmail, type SentEmail } from "./gmail";
import type { OutgoingEmail } from "./mime";

export class NoSendingInbox extends Error {
  constructor() {
    super("No sending inbox is connected. Connect it on the Projects page, then try again.");
  }
}

export async function connectedMailboxes(): Promise<Mailbox[]> {
  return (await db()).select().from(mailboxes).orderBy(desc(mailboxes.isSender), asc(mailboxes.connectedAt));
}

/** The inbox a thread started in, or else the one marked as the sender. */
export async function sendingMailbox(preferredId?: string | null): Promise<Mailbox | null> {
  const all = await connectedMailboxes();
  return all.find((mailbox) => mailbox.id === preferredId) ?? all[0] ?? null;
}

/** On a laptop with the dev shortcut on and no inbox connected, mail is recorded but goes nowhere. */
function devDelivery(email: OutgoingEmail): SentEmail {
  const id = randomUUID();
  return { gmailId: `dev-${id}`, threadId: email.threadId ?? `dev-thread-${id}`, headerMessageId: `<${id}@dev.localhost>` };
}

export type Delivery = SentEmail & { mailbox: Mailbox | null };

export async function deliver(
  compose: (from: Mailbox | null) => OutgoingEmail,
  preferredMailboxId?: string | null,
): Promise<Delivery & { email: OutgoingEmail }> {
  const mailbox = await sendingMailbox(preferredMailboxId);
  if (!mailbox && !devShortcutsEnabled) throw new NoSendingInbox();
  const email = compose(mailbox);
  const sent = mailbox ? await sendEmail(mailbox, email) : devDelivery(email);
  return { ...sent, mailbox, email };
}
