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

const REQUEST_TIMEOUT_MS = 20_000;
const READ_RETRY_DELAYS_MS = [500, 1_500];
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Gmail never answered, so a send that was in flight may or may not have gone out. */
export class GmailUnreachable extends Error {}

/** The send request got no answer. Gmail may have accepted the email, so it must not be sent again. */
export class SendOutcomeUnknown extends Error {}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function gmail<T>(mailbox: Mailbox, path: string, init: RequestInit = {}): Promise<T> {
  const headers = { Authorization: `Bearer ${await accessToken(mailbox)}`, "Content-Type": "application/json", ...init.headers };
  const retryDelays = init.method && init.method !== "GET" ? [] : READ_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw new GmailUnreachable(`Gmail ${path.split("?")[0]} did not answer: ${(error as Error).message}`);
    }
    if (response.ok) return readBody<T>(response, path);
    if (attempt < retryDelays.length && RETRYABLE_STATUSES.has(response.status)) {
      await pause(retryDelays[attempt]);
      continue;
    }
    throw new Error(`Gmail ${path.split("?")[0]} answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

async function readBody<T>(response: Response, path: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new GmailUnreachable(`Gmail ${path.split("?")[0]} answered but the answer was cut off: ${(error as Error).message}`);
  }
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

async function headerMessageIdOf(mailbox: Mailbox, gmailId: string): Promise<string> {
  try {
    const metadata = await gmail<GmailMessage>(mailbox, `/messages/${gmailId}?format=metadata&metadataHeaders=Message-ID`);
    return header(metadata.payload, "Message-ID");
  } catch {
    return "";
  }
}

async function postToGmail(mailbox: Mailbox, email: OutgoingEmail) {
  const raw = buildRawMessage(email);
  try {
    return await gmail<{ id: string; threadId: string }>(mailbox, "/messages/send", {
      method: "POST",
      body: JSON.stringify(email.threadId ? { raw, threadId: email.threadId } : { raw }),
    });
  } catch (error) {
    if (error instanceof GmailUnreachable) throw new SendOutcomeUnknown(`${error.message} The email may have gone out.`);
    throw error;
  }
}

export async function sendEmail(mailbox: Mailbox, email: OutgoingEmail): Promise<SentEmail> {
  const sent = await postToGmail(mailbox, email);
  return { gmailId: sent.id, threadId: sent.threadId, headerMessageId: await headerMessageIdOf(mailbox, sent.id) };
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

export type Folder = "inbox" | "sent";

const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 50;
const MESSAGES_READ_PER_RUN = 200;
const READ_CONCURRENCY = 5;

/** Every message ID in the query, newest first, page by page. */
async function listMessageIds(mailbox: Mailbox, query: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const list = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(mailbox, `/messages?q=${query}&maxResults=${LIST_PAGE_SIZE}${tokenPart}`);
    ids.push(...(list.messages ?? []).map((message) => message.id));
    pageToken = list.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

async function mapWithLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type MailBatch = {
  emails: IncomingEmail[];
  /** Set when older mail is still unread: the next run starts here instead of at the time of this run. */
  resumeFrom: Date | null;
};

/** Mail in one folder dated after `since`, oldest first, at most one run's worth. */
export async function mailSince(mailbox: Mailbox, folder: Folder, since: Date): Promise<MailBatch> {
  const query = encodeURIComponent(`in:${folder} after:${Math.floor(since.getTime() / 1000)}`);
  const oldestFirst = (await listMessageIds(mailbox, query)).reverse();
  const batch = oldestFirst.slice(0, MESSAGES_READ_PER_RUN);
  const full = await mapWithLimit(batch, READ_CONCURRENCY, (id) => gmail<GmailMessage>(mailbox, `/messages/${id}?format=full`));
  const emails = full.map(toIncoming).sort((a, b) => a.at.getTime() - b.at.getTime());
  const newest = emails[emails.length - 1];
  const resumeFrom = oldestFirst.length > batch.length && newest ? new Date(newest.at.getTime() - 1000) : null;
  return { emails, resumeFrom };
}
