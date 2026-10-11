"use server";

import { redirect } from "next/navigation";
import { spendSignInLink } from "@/server/editor/signInLinks";

export async function openEditorAction(form: FormData) {
  const destination = await spendSignInLink(String(form.get("code") ?? ""));
  redirect(destination ?? `/edit/open?code=${encodeURIComponent(String(form.get("code") ?? ""))}`);
}
