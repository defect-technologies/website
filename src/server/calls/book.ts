import "server-only";
import { eq, or } from "drizzle-orm";
import { bookingRange, callDays, isOpenSlot, type CallDay } from "@/lib/callSlots";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses } from "../db/schema";
import { addCall, busyTimes, callSetup, type CallRequest } from "./calendar";

export const CALLS_ACTOR = "defect.tech/call";

/** The days and times owners can book now, or null when defect.tech/call can't book and should forward instead. */
export async function openCallDays(now = Date.now()): Promise<CallDay[] | null> {
  const setup = await callSetup();
  if (!setup) return null;
  try {
    return callDays(now, await busyTimes(setup, bookingRange(now)));
  } catch (error) {
    console.error("[call]", error);
    return null;
  }
}

async function businessIdFor(email: string) {
  const [match] = await (await db())
    .select({ id: businesses.id })
    .from(businesses)
    .where(or(eq(businesses.email, email), eq(businesses.ownerEmail, email)))
    .limit(1);
  return match?.id ?? null;
}

export type BookingOutcome = { booked: true } | { booked: false; reason: "taken"; days: CallDay[] } | { booked: false; reason: "unavailable" };

/** Checks the time is still free, then adds the call. Google emails the invite to the owner and Brendan. */
export async function bookCall(call: CallRequest, now = Date.now()): Promise<BookingOutcome> {
  const setup = await callSetup();
  if (!setup) return { booked: false, reason: "unavailable" };
  try {
    const busy = await busyTimes(setup, bookingRange(now));
    if (!isOpenSlot(call.start, now, busy)) return { booked: false, reason: "taken", days: callDays(now, busy) };
    await addCall(setup, call);
  } catch (error) {
    console.error("[call]", error);
    await record(CALLS_ACTOR, "could not book a call", { detail: `${call.email}: ${(error as Error).message}`, priority: "review" });
    return { booked: false, reason: "unavailable" };
  }
  const when = new Date(call.start).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });
  await record(CALLS_ACTOR, "booked a call", { businessId: await businessIdFor(call.email), detail: `${call.name} (${call.email}), ${when}`, priority: "fyi" });
  return { booked: true };
}
