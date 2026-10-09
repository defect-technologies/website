"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFounder } from "@/server/auth/session";
import { resolveFlag } from "@/server/bots/flags";

const Resolution = z.object({
  id: z.uuid(),
  status: z.enum(["answered", "approved", "reversed"]),
  note: z.string().trim().max(4000),
});

export async function resolveFlagAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = Resolution.safeParse({ id: form.get("id"), status: form.get("status"), note: form.get("note") ?? "" });
  if (!parsed.success) return;
  if (parsed.data.status === "answered" && !parsed.data.note) return;
  await resolveFlag(parsed.data.id, parsed.data.status, parsed.data.note, founder.email);
  revalidatePath("/admin", "layout");
}
