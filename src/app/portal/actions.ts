"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailPortalLink, safeNext, setPassword, signInWithLink, signInWithPassword, type PasswordChange } from "@/server/portal/accounts";
import { isOwnerOf, portalSite } from "@/server/portal/context";
import { endPortalSession, requirePortalUser } from "@/server/portal/session";
import { record } from "@/server/activity";
import { launchDomainOf } from "@/server/integrations/domain";
import { businessById } from "@/server/leads/businesses";
import { launchBlocker, requestPreview } from "@/server/runner/jobs";
import { clientSite } from "@/server/sites/clientSites";
import { addEditorAndRecord, removeEditorAndRecord } from "@/server/sites/siteEditors";

export type SignInState = { status: "idle" | "sent" | "wrong" | "locked" | "invalid" | "not-ready"; email: string };

const SignIn = z.object({ intent: z.enum(["password", "link"]), email: z.email().max(200), password: z.string().max(200), next: z.string().max(200) });

/** One form, two buttons: the password signs in now; "Email me a link" needs only the email. */
export async function signInAction(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const parsed = SignIn.safeParse({ intent: form.get("intent"), email, password: form.get("password") ?? "", next: form.get("next") ?? "" });
  if (!parsed.success) return { status: "invalid", email };
  const next = safeNext(parsed.data.next);
  if (parsed.data.intent === "link") return { status: await emailPortalLink(email, next), email };
  const result = await signInWithPassword(email, parsed.data.password);
  if (result === "signed-in") redirect(next);
  return { status: result, email };
}

export async function openLinkAction(form: FormData) {
  const code = String(form.get("code") ?? "");
  const next = await signInWithLink(code);
  redirect(next ?? `/portal/open?code=${encodeURIComponent(code)}`);
}

export async function signOutAction() {
  await endPortalSession();
  redirect("/portal/sign-in");
}

export type PasswordState = { status: "idle" | PasswordChange };

export async function setPasswordAction(_previous: PasswordState, form: FormData): Promise<PasswordState> {
  const user = await requirePortalUser();
  const status = await setPassword(user.email, String(form.get("current") ?? ""), String(form.get("password") ?? ""));
  return { status };
}

/** The one-click button when we know the site: the link goes to its owner and opens that site's editor. */
export async function emailOwnerLinkAction(form: FormData) {
  const slug = String(form.get("site") ?? "").slice(0, 100);
  const site = await clientSite(slug);
  if (!site) redirect("/portal/sign-in");
  await emailPortalLink(site.ownerEmail, `/portal/edit/${site.slug}`);
  redirect(`/portal/sign-in?site=${encodeURIComponent(site.slug)}&result=sent`);
}

/** "Looks good, make it live" on the portal's checklist: the owner approves their preview and the launch starts. */
export async function approvePreviewAction(form: FormData) {
  const user = await requirePortalUser();
  const slug = String(form.get("site") ?? "");
  const site = await portalSite(user, slug);
  const lead = site?.businessId && isOwnerOf(site) ? await businessById(site.businessId) : null;
  if (!lead || launchBlocker(lead) || !launchDomainOf(lead)) redirect("/portal");
  const { job, created } = await requestPreview(lead, user.email, "The owner approved the preview in their portal.", "launch");
  if (created && job.kind === "launch") await record(user.email, "approved the preview and started the launch", { businessId: lead.id });
  revalidatePath("/portal");
  redirect(`/portal?site=${encodeURIComponent(slug)}`);
}

const accountPage = (slug: string, result: string) => `/portal/account?site=${encodeURIComponent(slug)}&editors=${result}`;

/** The site an owner is changing editors on. Editors can't choose who else edits, so they land back on their account. */
async function siteOwnedBySignedIn(form: FormData) {
  const user = await requirePortalUser();
  const site = await portalSite(user, String(form.get("site") ?? ""));
  if (!site || !isOwnerOf(site)) redirect("/portal/account");
  return { user, site };
}

export async function addEditorAction(form: FormData) {
  const { user, site } = await siteOwnedBySignedIn(form);
  const result = await addEditorAndRecord(site, String(form.get("email") ?? ""), user.email);
  revalidatePath("/portal/account");
  redirect(accountPage(site.slug, result));
}

export async function removeEditorAction(form: FormData) {
  const { user, site } = await siteOwnedBySignedIn(form);
  await removeEditorAndRecord(site, String(form.get("email") ?? ""), user.email);
  revalidatePath("/portal/account");
  redirect(accountPage(site.slug, "removed"));
}
