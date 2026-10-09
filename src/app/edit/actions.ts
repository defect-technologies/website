"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requestSignInLinks, spendSignInLink } from "@/server/editor/signInLinks";

export type LinkRequestState = { status: "idle" | "sent" | "not-ready" | "invalid"; email: string };

export async function requestLinkAction(_previous: LinkRequestState, form: FormData): Promise<LinkRequestState> {
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { status: "invalid", email: String(form.get("email") ?? "") };
  const status = await requestSignInLinks(parsed.data);
  return { status, email: parsed.data };
}

export async function openEditorAction(form: FormData) {
  const destination = await spendSignInLink(String(form.get("code") ?? ""));
  redirect(destination ?? `/edit/open?code=${encodeURIComponent(String(form.get("code") ?? ""))}`);
}
