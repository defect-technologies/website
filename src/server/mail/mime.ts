import "server-only";
import { randomUUID } from "node:crypto";
import { linksAsPlainText } from "@/lib/emailMarkup";

export type Address = { name: string; email: string };

export type OutgoingEmail = {
  from: Address;
  /** One address, or several joined with ", ". */
  to: string;
  cc?: string[];
  /** Gmail delivers to these and strips the header from what everyone receives. */
  bcc?: string[];
  subject: string;
  body: string;
  /** An HTML version shown by mail apps that render it; body stays the plain-text fallback. */
  html?: string;
  threadId?: string | null;
  inReplyTo?: string | null;
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

function copyHeader(name: "Cc" | "Bcc", addresses: string[] = []) {
  return addresses.length > 0 ? [`${name}: ${addresses.map(headerSafe).join(", ")}`] : [];
}

function threadingHeaders(inReplyTo?: string | null) {
  if (!inReplyTo) return [];
  const id = headerSafe(inReplyTo);
  return [`In-Reply-To: ${id}`, `References: ${id}`];
}

const QP_LINE_LENGTH = 75;

/** One byte as quoted-printable: printable ASCII and spaces as they are, everything else (and "=") as =XX. */
function quotedByte(byte: number) {
  const printable = (byte >= 33 && byte <= 126 && byte !== 61) || byte === 32;
  return printable ? String.fromCharCode(byte) : `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;
}

/** A line as quoted-printable, with soft breaks ("=" at the end) keeping each line under 76 characters. */
function quotedLine(line: string) {
  let encoded = "";
  let current = "";
  for (const byte of Buffer.from(line, "utf8")) {
    const next = quotedByte(byte);
    if (current.length + next.length > QP_LINE_LENGTH) {
      encoded += `${current}=\r\n`;
      current = "";
    }
    current += next;
  }
  // A space at the very end of a line would be stripped in transit, so it's encoded.
  return encoded + current.replace(/ $/, "=20");
}

/**
 * Text as quoted-printable (RFC 2045), the way mail apps send it. Base64 text reads to spam
 * filters as hidden content (SpamAssassin's MIME_BASE64_TEXT).
 */
function quotedPrintable(text: string) {
  return text.replace(/\r?\n/g, "\n").split("\n").map(quotedLine).join("\r\n");
}

const QUOTED_TEXT = (type: "plain" | "html") => [`Content-Type: text/${type}; charset=UTF-8`, "Content-Transfer-Encoding: quoted-printable"];

/** The body headers and content: plain text alone, or plain text and HTML as alternatives. */
function bodyParts(email: OutgoingEmail): { headers: string[]; content: string } {
  const plain = linksAsPlainText(email.body);
  if (!email.html) return { headers: QUOTED_TEXT("plain"), content: quotedPrintable(plain) };
  // "=_" can't occur in quoted-printable text, so the boundary never collides with the content.
  const boundary = `=_defect-${randomUUID()}`;
  const part = (type: "plain" | "html", text: string) => `--${boundary}\r\n${QUOTED_TEXT(type).join("\r\n")}\r\n\r\n${quotedPrintable(text)}`;
  return {
    headers: [`Content-Type: multipart/alternative; boundary="${boundary}"`],
    content: [part("plain", plain), part("html", email.html), `--${boundary}--`].join("\r\n"),
  };
}

/** An RFC 5322 message, base64url-encoded the way the Gmail API wants it. */
export function buildRawMessage(email: OutgoingEmail): string {
  const { headers: bodyHeaders, content } = bodyParts(email);
  const headers = [
    `From: ${mailbox(email.from)}`,
    `To: ${headerSafe(email.to)}`,
    ...copyHeader("Cc", email.cc),
    ...copyHeader("Bcc", email.bcc),
    `Subject: ${encodedWord(email.subject)}`,
    "MIME-Version: 1.0",
    ...bodyHeaders,
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
