"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endOwnerSession, requireOwner, startOwnerSession } from "@/server/auth/ownerSession";
import { redeemSignInLink, requestSignInLink } from "@/server/editor/signInLinks";
import { restoreOwnerVersion, saveOwnerEdit, type EditOutcome } from "@/server/sites/editing";

export type LinkRequestState = { status: "idle" | "sent" | "not-ready" | "invalid"; email: string };

export async function requestLinkAction(_previous: LinkRequestState, form: FormData): Promise<LinkRequestState> {
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { status: "invalid", email: String(form.get("email") ?? "") };
  const status = await requestSignInLink(parsed.data);
  return { status, email: parsed.data };
}

export async function redeemLinkAction(form: FormData) {
  const email = await redeemSignInLink(String(form.get("token") ?? ""));
  if (!email) redirect("/edit/sign-in?error=link");
  await startOwnerSession(email);
  redirect("/edit");
}

export async function signOutAction() {
  await endOwnerSession();
  redirect("/edit/sign-in");
}

export type SaveState = EditOutcome | { ok: null };

function parseContent(raw: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
}

export async function saveSiteAction(_previous: SaveState, form: FormData): Promise<SaveState> {
  const owner = await requireOwner();
  const slug = String(form.get("slug") ?? "");
  const baseVersion = Number(form.get("baseVersion"));
  const outcome = await saveOwnerEdit(owner, slug, baseVersion, parseContent(form.get("content")));
  if (outcome.ok) revalidatePath(`/edit/${slug}`, "layout");
  return outcome;
}

export async function restoreVersionAction(form: FormData) {
  const owner = await requireOwner();
  const slug = String(form.get("slug") ?? "");
  const version = Number(form.get("version"));
  const outcome = await restoreOwnerVersion(owner, slug, version);
  revalidatePath(`/edit/${slug}`, "layout");
  const result = outcome.ok ? `restored=${version}` : "restore=failed";
  redirect(`/edit/${encodeURIComponent(slug)}/history?${result}`);
}
