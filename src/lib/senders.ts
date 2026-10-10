/** Stored as a message's sentBy when the mail sync finds it in Gmail's Sent folder rather than the admin's outbox. */
export const SENT_FROM_GMAIL = "gmail";

/** Who sent one of our emails: a founder's name, or Gmail when a bot or a person sent it there directly. */
export function senderName(sentBy: string): string {
  if (sentBy === SENT_FROM_GMAIL) return "Gmail";
  return sentBy ? sentBy.split("@")[0] : "Us";
}

export function sentByLine(sentBy: string): string {
  if (sentBy === SENT_FROM_GMAIL) return "Us, sent from Gmail";
  return sentBy ? `Us, sent by ${senderName(sentBy)}` : "Us";
}
