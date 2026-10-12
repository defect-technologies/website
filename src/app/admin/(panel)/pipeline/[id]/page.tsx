import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrandFiles from "@/components/admin/BrandFiles";
import LeadForm from "@/components/admin/LeadForm";
import PreviewBuild from "@/components/admin/PreviewBuild";
import PreviewThumb from "@/components/admin/PreviewThumb";
import { ArmChip, Card, KeyValue, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { activityFor } from "@/server/activity";
import type { Activity, Business, Message } from "@/server/db/schema";
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
    const rows: [string, React.ReactNode][] = [["Came from", <Link key="requests" href="/admin/requests" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">A website request</Link>]];
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
    ["Clicks", business.clickCount > 0 ? <>{business.clickCount}, first <When date={business.clickedAt} /></> : "None yet"],
  ];
  if (business.placeId) rows.push(["Google Maps", <ExternalLink key="maps" href={`https://www.google.com/maps/place/?q=place_id:${business.placeId}`}>Open</ExternalLink>]);
  if (business.plan) rows.push(["Plan", business.plan]);
  return rows;
}

type Event = { at: Date; text: string; who: string };

function timeline(activity: Activity[], thread: Message[]): Event[] {
  const fromMail = thread.map((m) => ({ at: m.at, text: m.direction === "in" ? `They wrote: "${m.body.slice(0, 120)}${m.body.length > 120 ? "…" : ""}"` : `Emailed: ${m.subject}`, who: m.sentBy || m.fromAddress }));
  const fromActivity = activity.filter((a) => !a.action.startsWith("sent") && a.action !== "replied").map((a) => ({ at: a.at, text: a.detail ? `${a.action}: ${a.detail}` : a.action, who: a.actor }));
  return [...fromMail, ...fromActivity].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export default async function LeadPage({ params }: Params) {
  const business = await businessById((await params).id);
  if (!business) notFound();
  const [activity, thread, job, brand] = await Promise.all([activityFor(business.id), threadFor(business.id), activeJobFor(business.id), brandFilesFor(business.id)]);
  const events = timeline(activity, thread);
  const build = <PreviewBuild lead={business} job={job} command={buildCommand(business)} />;

  return (
    <>
      <Link href="/admin/overview?tab=leads" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
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
          <section className="flex flex-col gap-3">
            <SectionHeading>History</SectionHeading>
            {events.length === 0 ? (
              <p className="text-ink-soft text-sm">Nothing has happened yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {events.map((event, index) => (
                  <li key={index} className="flex flex-col gap-0.5 text-sm">
                    <span className="text-pretty">{event.text}</span>
                    <span className="text-ink-faint">
                      {event.who}, <When date={event.at} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
