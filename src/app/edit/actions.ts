"use server";

import { z } from "zod";
import { requestSignInLinks } from "@/server/editor/signInLinks";

export type LinkRequestState = { status: "idle" | "sent" | "not-ready" | "invalid"; email: string };

export async function requestLinkAction(_previous: LinkRequestState, form: FormData): Promise<LinkRequestState> {
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { status: "invalid", email: String(form.get("email") ?? "") };
  const status = await requestSignInLinks(parsed.data);
  return { status, email: parsed.data };
}
