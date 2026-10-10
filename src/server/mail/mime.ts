import "server-only";
import { randomUUID } from "node:crypto";

export type Address = { name: string; email: string };

export type OutgoingEmail = {
  from: Address;
  to: string;
  subject: string;
  body: string;
  /** An HTML version shown by mail apps that render it; body stays the plain-text fallback. */
  html?: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  /** Cold email needs a one-click way out. Clients' email leaves it off, or mail apps file it as a mailing list. */
  listUnsubscribe?: boolean;
};

/** Header values come partly from scraped websites, so line breaks are never allowed through. */
function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedWord(value: string) {
  const safe = headerSafe(value);
  // Printable ASCII passes through as is; anything else goes as a UTF-8 encoded word (RFC 2047).
  return /^[\x20-\x7e]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function mailbox({ name, email }: Address) {
  const display = encodedWord(name).replace(/"/g, "'");
  return display ? `"${display}" <${headerSafe(email)}>` : headerSafe(email);
}

function threadingHeaders(inReplyTo?: string | null) {
  if (!inReplyTo) return [];
  const id = headerSafe(inReplyTo);
  return [`In-Reply-To: ${id}`, `References: ${id}`];
}

function wrapBase64(text: string) {
  return (Buffer.from(text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

const BASE64_TEXT = (type: "plain" | "html") => [`Content-Type: text/${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64"];

/** The body headers and content: plain text alone, or plain text and HTML as alternatives. */
function bodyParts(email: OutgoingEmail): { headers: string[]; content: string } {
  if (!email.html) return { headers: BASE64_TEXT("plain"), content: wrapBase64(email.body) };
  const boundary = `defect-${randomUUID()}`;
  const part = (type: "plain" | "html", text: string) => `--${boundary}\r\n${BASE64_TEXT(type).join("\r\n")}\r\n\r\n${wrapBase64(text)}`;
  return {
    headers: [`Content-Type: multipart/alternative; boundary="${boundary}"`],
    content: [part("plain", email.body), part("html", email.html), `--${boundary}--`].join("\r\n"),
  };
}

/** An RFC 5322 message, base64url-encoded the way the Gmail API wants it. */
export function buildRawMessage(email: OutgoingEmail): string {
  const { headers: bodyHeaders, content } = bodyParts(email);
  const headers = [
    `From: ${mailbox(email.from)}`,
    `To: ${headerSafe(email.to)}`,
    `Subject: ${encodedWord(email.subject)}`,
    "MIME-Version: 1.0",
    ...bodyHeaders,
    ...(email.listUnsubscribe ? [`List-Unsubscribe: <mailto:${headerSafe(email.from.email)}?subject=unsubscribe>`] : []),
    ...threadingHeaders(email.inReplyTo),
  ];
  const message = `${headers.join("\r\n")}\r\n\r\n${content}`;
  return Buffer.from(message, "utf8").toString("base64url");
}

/** The address inside `"Name" <a@b.com>`, lowercased. */
export function addressOf(header: string): string {
  const bracketed = header.match(/<([^>]+)>/);
  return (bracketed ? bracketed[1] : header).trim().toLowerCase();
}

export function domainOf(emailOrUrl: string): string {
  const value = emailOrUrl.trim().toLowerCase();
  if (value.includes("@")) return value.split("@").pop() ?? "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Drops the quoted history under a reply, so a thread shows what each person actually wrote. */
export function withoutQuotedHistory(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((line) => /^On .+wrote:\s*$/.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line.trim()));
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  return kept
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
}
