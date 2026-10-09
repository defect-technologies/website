"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFounder } from "@/server/auth/session";
import { rollBackSite } from "@/server/sites/editing";

export async function rollBackAction(form: FormData) {
  const founder = await requireFounder();
  const slug = String(form.get("slug") ?? "");
  const version = Number(form.get("version"));
  const outcome = await rollBackSite(founder, slug, version);
  revalidatePath("/admin/sites", "layout");
  revalidatePath(`/edit/${slug}`, "layout");
  redirect(`/admin/sites/${encodeURIComponent(slug)}?${outcome.ok ? `rolledBack=${version}` : "rollBack=failed"}`);
}
