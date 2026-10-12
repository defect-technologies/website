"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emailPortalLink, safeNext, setPassword, signInWithLink, signInWithPassword, type PasswordChange } from "@/server/portal/accounts";
import { endOwnerSession, requireOwner } from "@/server/portal/session";
import { record } from "@/server/activity";
import { launchDomainOf } from "@/server/integrations/domain";
import { businessById } from "@/server/leads/businesses";
import { launchBlocker, requestPreview } from "@/server/runner/jobs";
import { clientSite, sitesForOwner } from "@/server/sites/clientSites";

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
  await endOwnerSession();
  redirect("/portal/sign-in");
}

export type PasswordState = { status: "idle" | PasswordChange };

export async function setPasswordAction(_previous: PasswordState, form: FormData): Promise<PasswordState> {
  const owner = await requireOwner();
  const status = await setPassword(owner.email, String(form.get("current") ?? ""), String(form.get("password") ?? ""));
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
  const owner = await requireOwner();
  const slug = String(form.get("site") ?? "");
  const site = (await sitesForOwner(owner.email)).find((candidate) => candidate.slug === slug);
  const lead = site?.businessId ? await businessById(site.businessId) : null;
  if (!lead || launchBlocker(lead) || !launchDomainOf(lead)) redirect("/portal");
  const { job, created } = await requestPreview(lead, owner.email, "The owner approved the preview in their portal.", "launch");
  if (created && job.kind === "launch") await record(owner.email, "approved the preview and started the launch", { businessId: lead.id });
  revalidatePath("/portal");
  redirect(`/portal?site=${encodeURIComponent(slug)}`);
}
