import { ArrowLeft, ArrowSquareOut, EnvelopeSimple, UserSwitch, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OpenEditorButton from "@/components/admin/OpenEditorButton";
import SubmitButton from "@/components/admin/SubmitButton";
import { TextField } from "@/components/admin/fields";
import { Card, KeyValue, Notice, SectionHeading, StatusMark, When } from "@/components/admin/ui";
import { LINK_MINUTES, editorReady, linksReady } from "@/server/editor/signInLinks";
import { clientSite, type ClientSiteRow } from "@/server/sites/clientSites";
import { changeOwnerAction, sendLinkAction } from "../actions";

type Query = { added?: string; link?: string; owner?: string; editor?: string };
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Query> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await clientSite((await params).slug);
  return { title: site ? new URL(site.url).host : "Site" };
}

function facts(site: ClientSiteRow): [string, React.ReactNode][] {
  return [
    [
      "Address",
      <a key="url" href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
        {new URL(site.url).host}
        <ArrowSquareOut size={14} aria-hidden="true" />
      </a>,
    ],
    ["Slug", <span key="slug" className="font-mono">{site.slug}</span>],
    ["Repo", <span key="repo" className="font-mono">site-{site.slug}</span>],
    ["Client", site.businessId ? <Link key="client" href={`/admin/sites/${site.businessId}`} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">{site.businessName}</Link> : "Not linked"],
    ["Added", <span key="added">{site.createdBy}, <When date={site.createdAt} /></span>],
  ];
}

function notices(site: ClientSiteRow, query: Query) {
  const host = new URL(site.url).host;
  const shown: [boolean, "good" | "bad" | "warn", string][] = [
    [Boolean(query.added), "good", "Site added."],
    [query.link === "sent", "good", `Emailed ${site.ownerEmail} a link. It works once, within ${LINK_MINUTES} minutes.`],
    [query.link === "failed", "bad", "Resend refused the link, so nothing was sent. Check Resend's logs, then try again."],
    [query.owner === "changed", "good", `Sign-in links for ${host} now go to ${site.ownerEmail}.`],
    [query.editor === "not-ready", "bad", "Set EDITOR_SECRET on this Vercel project to open the editor."],
    [query.owner === "invalid", "bad", "Check that email address and try again."],
  ];
  return shown.filter(([visible]) => visible).map(([, tone, text]) => (
    <Notice key={text} tone={tone}>
      {text}
    </Notice>
  ));
}

export default async function SitePage({ params, searchParams }: Props) {
  const site = await clientSite((await params).slug);
  if (!site) notFound();
  const query = await searchParams;
  const ready = linksReady();

  return (
    <>
      <Link href="/admin/sites?status=live" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Sites
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl leading-none font-black break-words">{new URL(site.url).host}</h1>
        <OpenEditorButton slug={site.slug} label="Open editor" variant="solid" disabled={!editorReady()} />
      </header>
      {notices(site, query)}
      <Card className="p-6">
        <KeyValue rows={facts(site)} />
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeading>Owner</SectionHeading>
        {!ready && <StatusMark icon={WarningCircle} tone="warn" label="Sign-in links off" detail="Set SIGN_IN_EMAIL_API_KEY, SIGN_IN_EMAIL_FROM and EDITOR_SECRET on this Vercel project." />}
        <form action={sendLinkAction}>
          <input type="hidden" name="slug" value={site.slug} />
          <SubmitButton variant="soft" disabled={!ready} icon={<EnvelopeSimple size={18} aria-hidden="true" />}>
            Email {site.ownerEmail} a sign-in link
          </SubmitButton>
        </form>
        <Card className="p-6">
          <form action={changeOwnerAction} className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="slug" value={site.slug} />
            <div className="min-w-64 flex-1">
              <TextField label="New owner's email" name="ownerEmail" type="email" required autoComplete="off" />
            </div>
            <SubmitButton variant="soft" icon={<UserSwitch size={18} aria-hidden="true" />}>
              Change owner
            </SubmitButton>
          </form>
        </Card>
      </section>
    </>
  );
}
