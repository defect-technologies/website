/** What the outreach card's fields hold. Each address field can list several, separated by commas. */
export type EmailDraft = { to: string; cc: string; bcc: string; subject: string; body: string };

/** An edited email a founder saved without sending. kind keeps a first email's draft from turning up on the follow-up. */
export type SavedDraft = EmailDraft & { kind: "first" | "follow_up" | "requested"; savedBy: string; savedAt: string };
