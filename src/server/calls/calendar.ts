import "server-only";
import { callEnd, type Span } from "@/lib/callSlots";
import type { Mailbox } from "../db/schema";
import { env } from "../env";
import { accessToken } from "../mail/gmail";
import { sendingMailbox } from "../mail/outbox";
import { freeBusyToken, serviceAccount } from "./serviceAccount";

const API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 15_000;

/** Google could not tell us when Brendan is free, or would not add the call. The page falls back to email. */
export class CallsUnavailable extends Error {}

type FreeBusyResponse = { calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };

export type CallSetup = { mailbox: Mailbox; calendars: string[] };

/** Everything defect.tech/call needs, or null while any of it is missing. */
export async function callSetup(): Promise<CallSetup | null> {
  const calendars = env.callCalendars();
  if (!calendars.length || !serviceAccount()) return null;
  const mailbox = await sendingMailbox();
  return mailbox ? { mailbox, calendars } : null;
}

async function freeBusy(token: string, ids: string[], range: Span): Promise<Span[]> {
  const response = await fetch(`${API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: new Date(range.start).toISOString(), timeMax: new Date(range.end).toISOString(), items: ids.map((id) => ({ id })) }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new CallsUnavailable(`Google freeBusy answered ${response.status}`);
  const { calendars } = (await response.json()) as FreeBusyResponse;
  const unreadable = Object.entries(calendars).filter(([, calendar]) => calendar.errors?.length);
  if (unreadable.length) throw new CallsUnavailable(`Google could not read ${unreadable.length} calendar(s)`);
  return Object.values(calendars).flatMap((calendar) => (calendar.busy ?? []).map((busy) => ({ start: Date.parse(busy.start), end: Date.parse(busy.end) })));
}

/** Busy times on Brendan's calendars and on the sending inbox's, where the booked calls go. */
export async function busyTimes(setup: CallSetup, range: Span): Promise<Span[]> {
  const account = serviceAccount();
  if (!account) throw new CallsUnavailable("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const [brendans, organizers] = await Promise.all([
    freeBusy(await freeBusyToken(account), setup.calendars, range),
    freeBusy(await accessToken(setup.mailbox), ["primary"], range),
  ]);
  return [...brendans, ...organizers];
}

export type CallRequest = { start: number; name: string; email: string; business: string; note: string };

function callEvent(setup: CallSetup, call: CallRequest) {
  const title = call.business ? `Defect intro call: ${call.business}` : `Defect intro call: ${call.name}`;
  return {
    summary: title,
    description: [`Booked on defect.tech/call by ${call.name} (${call.email}).`, call.note].filter(Boolean).join("\n\n"),
    start: { dateTime: new Date(call.start).toISOString() },
    end: { dateTime: new Date(callEnd(call.start)).toISOString() },
    attendees: [{ email: call.email, displayName: call.name }, { email: setup.calendars[0] }],
    conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: true },
  };
}

/** Puts the call on the sending inbox's calendar with a Meet link. Google emails the invite to the owner and Brendan. */
export async function addCall(setup: CallSetup, call: CallRequest): Promise<void> {
  const response = await fetch(`${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(setup.mailbox)}`, "Content-Type": "application/json" },
    body: JSON.stringify(callEvent(setup, call)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new CallsUnavailable(`Google Calendar answered ${response.status} when adding the call`);
}
