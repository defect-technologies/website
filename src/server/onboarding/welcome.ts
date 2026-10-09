import "server-only";
import { record } from "../activity";
import { db } from "../db/client";
import { messages, type Business } from "../db/schema";
import { deliver } from "../mail/outbox";
import { outreachSettings } from "../settings";

const SUBJECT = "Welcome to Defect Technologies";

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
    "The Defect Technologies team",
    "hello@defect.tech",
  ].join("\n");
}

/** Sent once, right after Stripe reports the checkout. The Onboarding bot follows up from the same inbox. */
export async function sendWelcome(business: Business, to: string) {
  const { senderName } = await outreachSettings();
  try {
    const delivery = await deliver(
      (from) => ({ from: { name: senderName, email: from?.email ?? "outbox@dev.localhost" }, to, subject: SUBJECT, body: welcomeBody(business) }),
      business.mailboxId,
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
