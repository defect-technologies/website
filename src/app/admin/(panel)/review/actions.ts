"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FlagStatus } from "@/lib/bots";
import { requireFounder } from "@/server/auth/session";
import { resolveFlag } from "@/server/bots/flags";
import { db } from "@/server/db/client";
import { flags, type Flag } from "@/server/db/schema";
import { businessById } from "@/server/leads/businesses";
import { requestPreview } from "@/server/runner/jobs";

const Resolution = z.object({
  id: z.uuid(),
  intent: z.enum(["answer", "fixed", "dismiss", "retry"]),
  answer: z.string().trim().max(4000).default(""),
});
type Resolution = z.infer<typeof Resolution>;

async function retry(flag: Flag, founder: string): Promise<string | null> {
  const lead = flag.businessId ? await businessById(flag.businessId) : null;
  if (!lead) return null;
  const kind = flag.topic === "launch" ? "launch" : "preview";
  await requestPreview(lead, founder, "", kind);
  return kind === "launch" ? "Retried the launch." : "Rebuilt the preview.";
}

const RESOLVE: Record<Resolution["intent"], (flag: Flag, input: Resolution, founder: string) => Promise<[Exclude<FlagStatus, "open">, string] | null>> = {
  answer: async (_flag, { answer }) => (answer ? ["answered", answer] : null),
  fixed: async () => ["fixed", "Fixed."],
  dismiss: async () => ["closed", "Dismissed: nothing to do."],
  retry: async (flag, _input, founder) => {
    const note = await retry(flag, founder);
    return note ? ["fixed", note] : null;
  },
};

/** One action for every button on a card: the button's intent says what it does. */
export async function resolveFlagAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = Resolution.safeParse({ id: form.get("id"), intent: form.get("intent"), answer: form.get("answer") ?? "" });
  if (!parsed.success) return;
  const [flag] = await (await db()).select().from(flags).where(eq(flags.id, parsed.data.id));
  if (!flag || flag.status !== "open") return;
  const resolution = await RESOLVE[parsed.data.intent](flag, parsed.data, founder.email);
  if (!resolution) return;
  await resolveFlag(flag.id, resolution[0], resolution[1], founder.email);
  revalidatePath("/admin", "layout");
}
