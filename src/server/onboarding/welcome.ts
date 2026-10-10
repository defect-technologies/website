import "server-only";
import { record } from "../activity";
import { db } from "../db/client";
import { messages, type Business } from "../db/schema";
import { connectedMailboxes, deliver } from "../mail/outbox";
import { TEAM_SIGNATURE_TEXT, withTeamSignatureHtml } from "../mail/teamSignature";

const SUBJECT = "Welcome to Defect Technologies";
/** Clients hear from the studio inbox, never from a cold-email domain. */
const STUDIO_INBOX = "hello@defect.tech";
/** The studio inbox writes as the team; founders' names are for cold email only. */
export const STUDIO_NAME = "Defect Technologies";

export async function studioMailboxId() {
  const studio = (await connectedMailboxes()).find((mailbox) => mailbox.email.toLowerCase() === STUDIO_INBOX);
  if (!studio) throw new Error(`${STUDIO_INBOX} isn't connected on the Projects page.`);
  return studio.id;
}

function welcomeBody(business: Business) {
  return [
    `Hi ${business.ownerFirstName || "there"},`,
    "",
    `Thank you for signing up! We're so happy to have ${business.businessName} with us.`,
    "",
    "Someone from the Defect Technologies team will email you soon to get your new website live.",
    "",
    "Warmly,",
    "",
    ...TEAM_SIGNATURE_TEXT,
  ].join("\n");
}

/** Sent once, right after Stripe reports the checkout. It always comes from the studio inbox, where the Onboarding bot follows up. */
export async function sendWelcome(business: Business, to: string) {
  const body = welcomeBody(business);
  try {
    const delivery = await deliver(
      (from) => ({ from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" }, to, subject: SUBJECT, body, html: withTeamSignatureHtml(body) }),
      await studioMailboxId(),
    );
    await (await db()).insert(messages).values({
      businessId: business.id,
      mailboxId: delivery.mailbox?.id ?? null,
      direction: "out",
      kind: "welcome",
      gmailId: delivery.gmailId,
      threadId: delivery.threadId,
      headerMessageId: delivery.headerMessageId,
      fromAddress: delivery.email.from.email,
      toAddress: to,
      subject: SUBJECT,
      body: delivery.email.body,
      sentBy: "stripe sync",
    });
    await record("stripe sync", "sent welcome email", { businessId: business.id, detail: to });
  } catch (error) {
    await record("stripe sync", "welcome email failed", { businessId: business.id, detail: (error as Error).message });
  }
}
