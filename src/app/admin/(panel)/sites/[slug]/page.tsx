import { ArrowLeft, ArrowSquareOut, EnvelopeSimple, UserSwitch } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SubmitButton from "@/components/admin/SubmitButton";
import { TextField } from "@/components/admin/fields";
import { Card, KeyValue, Notice, SectionHeading, When } from "@/components/admin/ui";
import { LINK_MINUTES, linksReady } from "@/server/editor/signInLinks";
import { clientSite, type ClientSiteRow } from "@/server/sites/clientSites";
import { changeOwnerAction, sendLinkAction } from "../actions";

type Query = { added?: string; link?: string; owner?: string };
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
    ["Client", site.businessId ? <Link key="client" href={`/admin/pipeline/${site.businessId}`} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">{site.businessName}</Link> : "Not linked"],
    ["Added", <span key="added">{site.createdBy}, <When date={site.createdAt} /></span>],
  ];
}

function notices(site: ClientSiteRow, query: Query) {
  const host = new URL(site.url).host;
  const shown: [boolean, "good" | "bad" | "warn", string][] = [
    [Boolean(query.added), "good", `Added. ${site.ownerEmail} can now ask for a sign-in link at defect.tech/edit/sign-in, or you can email one below.`],
    [query.link === "sent", "good", `Emailed ${site.ownerEmail} a link to edit ${host}. It works once, within ${LINK_MINUTES} minutes.`],
    [query.link === "failed", "bad", "The email service refused the link, so nothing was sent. Check Resend's logs, then try again."],
    [query.owner === "changed", "good", `Sign-in links for ${host} now go to ${site.ownerEmail}.`],
    [query.owner === "invalid", "bad", "That email address doesn't look right, so the owner didn't change. Check it and try again."],
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
      <Link href="/admin/sites" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Sites
      </Link>
      <h1 className="font-display text-5xl leading-none font-black break-words">{new URL(site.url).host}</h1>
      {notices(site, query)}
      <Card className="p-6">
        <KeyValue rows={facts(site)} />
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeading>Owner</SectionHeading>
        <p className="text-ink-soft max-w-prose text-pretty">
          The editor is at {new URL("/edit", site.url).toString()}. It opens only from a sign-in link sent to {site.ownerEmail}, and each link works once, within {LINK_MINUTES} minutes.
        </p>
        {!ready && <Notice tone="warn">Sign-in links need SIGN_IN_EMAIL_API_KEY, SIGN_IN_EMAIL_FROM and EDITOR_SECRET set on this Vercel project.</Notice>}
        <form action={sendLinkAction}>
          <input type="hidden" name="slug" value={site.slug} />
          <SubmitButton variant="solid" disabled={!ready} icon={<EnvelopeSimple size={18} aria-hidden="true" />}>
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
