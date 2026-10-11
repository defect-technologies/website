"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ABOUT_LIMIT } from "@/lib/inbound";
import { requireFounder } from "@/server/auth/session";
import { acceptRequest, closeRequest, declineRequest, InboundError, resortRequest } from "@/server/inbound/requests";

export type RequestActionState = { ok: boolean; message: string };

const IDLE: RequestActionState = { ok: false, message: "" };

const website = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
  .pipe(z.union([z.literal(""), z.url({ protocol: /^https?$/ })]));

const AcceptForm = z.object({
  id: z.uuid(),
  businessName: z.string().trim().min(1, "Give the business a name.").max(200),
  name: z.string().trim().max(200),
  email: z.email("Add an email address to send the preview to.").trim().toLowerCase(),
  website,
  about: z.string().trim().max(ABOUT_LIMIT),
});

const ReplyForm = z.object({ id: z.uuid(), reply: z.string().trim().max(10_000), intent: z.enum(["reply", "close"]).default("reply") });

/** Runs a founder's decision, turning a refusal into a message the card can show. */
async function decide(run: () => Promise<unknown>, done: string): Promise<RequestActionState> {
  try {
    await run();
  } catch (error) {
    if (error instanceof InboundError) return { ok: false, message: error.message };
    return { ok: false, message: `Nothing changed. ${(error as Error).message}` };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: done };
}

export async function acceptRequestAction(_previous: RequestActionState, form: FormData): Promise<RequestActionState> {
  const founder = await requireFounder();
  const parsed = AcceptForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  const { id, ...fields } = parsed.data;
  return decide(() => acceptRequest(id, fields, founder.email), "Queued. The preview lands in Outreach once it's built.");
}

export async function declineRequestAction(_previous: RequestActionState, form: FormData): Promise<RequestActionState> {
  const founder = await requireFounder();
  const parsed = ReplyForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return IDLE;
  return decide(() => declineRequest(parsed.data.id, parsed.data.reply, founder.email), "Turned down.");
}

export async function closeRequestAction(_previous: RequestActionState, form: FormData): Promise<RequestActionState> {
  const founder = await requireFounder();
  const parsed = ReplyForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return IDLE;
  const reply = parsed.data.intent === "close" ? "" : parsed.data.reply;
  if (parsed.data.intent === "reply" && !reply) return { ok: false, message: "Write a reply first, or close it without replying." };
  return decide(() => closeRequest(parsed.data.id, reply, founder.email), reply ? "Sent." : "Closed.");
}

const ResortForm = z.object({ id: z.uuid(), kind: z.enum(["request", "ignore"]) });

export async function resortRequestAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = ResortForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  await resortRequest(parsed.data.id, parsed.data.kind, founder.email).catch(() => undefined);
  revalidatePath("/admin", "layout");
}
