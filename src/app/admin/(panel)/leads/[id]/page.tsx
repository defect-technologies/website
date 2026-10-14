import { ArrowLeft, ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrandFiles from "@/components/admin/BrandFiles";
import LeadForm from "@/components/admin/LeadForm";
import PreviewBuild from "@/components/admin/PreviewBuild";
import PreviewThumb from "@/components/admin/PreviewThumb";
import ShowMore from "@/components/admin/ShowMore";
import { ArmChip, Card, KeyValue, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { activityFor } from "@/server/activity";
import { actorLabel } from "@/lib/bots";
import type { Activity, Business } from "@/server/db/schema";
import { env } from "@/server/env";
import { brandFilesFor } from "@/server/leads/brandFiles";
import { buildCommand } from "@/server/leads/buildCommand";
import { businessById } from "@/server/leads/businesses";
import { threadFor } from "@/server/mail/threads";
import { previewLink } from "@/server/outreach/compose";
import { activeJobFor } from "@/server/runner/jobs";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const business = await businessById((await params).id);
  return { title: business?.businessName ?? "Lead" };
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
      {children}
      <ArrowSquareOut size={14} aria-hidden="true" />
    </a>
  );
}

/** A business that asked us has no audit; what it told us stands in for one. */
function originRows(business: Business): [string, React.ReactNode][] {
  if (business.source === "request") {
    const rows: [string, React.ReactNode][] = [["Came from", "A website request"]];
    if (business.brief) rows.push(["What they told us", <span key="brief" className="whitespace-pre-wrap">{business.brief}</span>]);
    return rows;
  }
  return [
    ["Platform", business.platform || "Unknown"],
    ["Outdated", business.outdatedSignals || `Score ${business.outdatedScore}`],
    ["Niche and area", [business.niche, business.area].filter(Boolean).join(", ") || "Unknown"],
  ];
}

function facts(business: Business): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [
    ["Website", business.website ? <ExternalLink href={business.website}>{business.website.replace(/^https?:\/\//, "")}</ExternalLink> : "None"],
    ...originRows(business),
    ["Link in emails", <span key="link" className="font-mono text-sm">{previewLink(business)}</span>],
    ["Opens", business.clickCount > 0 ? <>{business.clickCount}, first <When date={business.clickedAt} /></> : "None"],
  ];
  if (business.placeId) rows.push(["Google Maps", <ExternalLink key="maps" href={`https://www.google.com/maps/place/?q=place_id:${business.placeId}`}>Open</ExternalLink>]);
  if (business.plan) rows.push(["Plan", business.plan]);
  return rows;
}

/** What happened to the lead, minus the emails themselves: those read better as the conversation on Messages. */
function History({ activity, emails, businessId }: { activity: Activity[]; emails: number; businessId: string }) {
  const events = activity.filter((entry) => !entry.action.startsWith("sent") && entry.action !== "replied");
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading>History</SectionHeading>
        {emails > 0 && (
          <Link href={`/admin/messages?b=${businessId}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
            {emails} {emails === 1 ? "email" : "emails"} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {events.length === 0 ? (
        <p className="text-ink-faint text-sm">Nothing yet</p>
      ) : (
        <ShowMore
          items={events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 text-sm">
              <span className="line-clamp-2 text-pretty" title={event.detail || undefined}>
                {event.detail ? `${event.action}: ${event.detail}` : event.action}
              </span>
              <span className="text-ink-faint">
                {actorLabel(event.actor)}, <When date={event.at} />
              </span>
            </li>
          ))}
        />
      )}
    </section>
  );
}

export default async function LeadPage({ params }: Params) {
  const business = await businessById((await params).id);
  if (!business) notFound();
  const [activity, thread, job, brand] = await Promise.all([activityFor(business.id), threadFor(business.id), activeJobFor(business.id), brandFilesFor(business.id)]);
  const build = <PreviewBuild lead={business} job={job} command={buildCommand(business)} />;

  return (
    <>
      <Link href="/admin/leads" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Leads
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-5xl leading-none font-black">{business.businessName}</h1>
        <StageChip stage={business.stage} />
        <ArmChip arm={business.priceArm} />
      </header>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {business.stage === "new" && build}
          <Card className="p-5">
            <LeadForm business={business} />
          </Card>
          {business.stage !== "new" && build}
          <BrandFiles leadId={business.id} files={brand} canUpload={Boolean(env.brandFilesToken())} />
        </div>
        <aside className="flex flex-col gap-6">
          <PreviewThumb url={business.previewUrl} name={business.businessName} />
          <KeyValue rows={facts(business)} />
          <History activity={activity} emails={thread.length} businessId={business.id} />
        </aside>
      </div>
    </>
  );
}
