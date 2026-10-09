import "server-only";
import { googleClient } from "../auth/google";
import { unseal } from "../seal";
import type { Mailbox } from "../db/schema";
import { addressOf, buildRawMessage, withoutQuotedHistory, type OutgoingEmail } from "./mime";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type SentEmail = { gmailId: string; threadId: string; headerMessageId: string };

export type IncomingEmail = {
  gmailId: string;
  threadId: string;
  headerMessageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  at: Date;
};

export class MailboxNeedsReconnect extends Error {}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

async function accessToken(mailbox: Mailbox): Promise<string> {
  const cached = accessTokens.get(mailbox.id);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const google = googleClient("mail");
  if (!google) throw new Error("GOOGLE_MAIL_CLIENT_ID and GOOGLE_MAIL_CLIENT_SECRET are not set.");
  try {
    const tokens = await google.refreshAccessToken(unseal(mailbox.sealedRefreshToken));
    accessTokens.set(mailbox.id, { token: tokens.accessToken(), expiresAt: tokens.accessTokenExpiresAt().getTime() });
    return tokens.accessToken();
  } catch (error) {
    throw new MailboxNeedsReconnect(`Google refused ${mailbox.email}'s saved sign-in: ${(error as Error).message}`);
  }
}

async function gmail<T>(mailbox: Mailbox, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(mailbox)}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`Gmail ${path.split("?")[0]} answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: Header[] };
type GmailMessage = { id: string; threadId: string; internalDate: string; payload: Part };

function header(part: Part, name: string) {
  return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decode(data?: string) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function findPart(part: Part, mimeType: string): Part | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function textOf(payload: Part): string {
  const plain = findPart(payload, "text/plain");
  if (plain) return decode(plain.body?.data);
  const html = decode(findPart(payload, "text/html")?.body?.data);
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
}

export async function sendEmail(mailbox: Mailbox, email: OutgoingEmail): Promise<SentEmail> {
  const raw = buildRawMessage(email);
  const sent = await gmail<{ id: string; threadId: string }>(mailbox, "/messages/send", {
    method: "POST",
    body: JSON.stringify(email.threadId ? { raw, threadId: email.threadId } : { raw }),
  });
  const metadata = await gmail<GmailMessage>(mailbox, `/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`);
  return { gmailId: sent.id, threadId: sent.threadId, headerMessageId: header(metadata.payload, "Message-ID") };
}

function toIncoming(message: GmailMessage): IncomingEmail {
  return {
    gmailId: message.id,
    threadId: message.threadId,
    headerMessageId: header(message.payload, "Message-ID"),
    from: addressOf(header(message.payload, "From")),
    to: addressOf(header(message.payload, "To")),
    subject: header(message.payload, "Subject"),
    body: withoutQuotedHistory(textOf(message.payload)),
    at: new Date(Number(message.internalDate)),
  };
}

/** Inbox mail that arrived after `since`, oldest first. */
export async function inboxSince(mailbox: Mailbox, since: Date): Promise<IncomingEmail[]> {
  const query = encodeURIComponent(`in:inbox after:${Math.floor(since.getTime() / 1000)}`);
  const list = await gmail<{ messages?: { id: string }[] }>(mailbox, `/messages?q=${query}&maxResults=100`);
  const full = await Promise.all(
    (list.messages ?? []).map((m) => gmail<GmailMessage>(mailbox, `/messages/${m.id}?format=full`)),
  );
  return full.map(toIncoming).sort((a, b) => a.at.getTime() - b.at.getTime());
}
