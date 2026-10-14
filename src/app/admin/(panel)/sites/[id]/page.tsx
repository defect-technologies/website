import { ArrowLeft, ArrowSquareOut, ChatsCircle, Globe, Eye, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonClasses } from "@/components/Button";
import BrandFiles from "@/components/admin/BrandFiles";
import BuildProgress, { clockTime } from "@/components/admin/BuildProgress";
import Conversation from "@/components/admin/Conversation";
import FlagCard from "@/components/admin/FlagCard";
import JourneyStrip from "@/components/admin/JourneyStrip";
import LeadForm from "@/components/admin/LeadForm";
import OpenEditorButton from "@/components/admin/OpenEditorButton";
import LeadStatusMark from "@/components/admin/overview/LeadStatusMark";
import PageTabs from "@/components/admin/PageTabs";
import PreviewBuild from "@/components/admin/PreviewBuild";
import PreviewThumb from "@/components/admin/PreviewThumb";
import SiteHistory from "@/components/admin/SiteHistory";
import SpotCheckCard from "@/components/admin/SpotCheckCard";
import { ArmChip, Card, KeyValue, Section, StatusMark, When } from "@/components/admin/ui";
import { leadStatus } from "@/lib/leadStatus";
import type { Business } from "@/server/db/schema";
import { env } from "@/server/env";
import { buildCommand } from "@/server/leads/buildCommand";
import { businessById } from "@/server/leads/businesses";
import { markThreadRead } from "@/server/mail/threads";
import { previewLink } from "@/server/outreach/compose";
import { activeJobFor } from "@/server/runner/jobs";
import { clientSite } from "@/server/sites/clientSites";
import { siteDetail, type SiteDetail } from "@/server/sites/siteDetail";

type Tab = "overview" | "messages" | "history" | "details";
const TABS: Tab[] = ["overview", "messages", "history", "details"];

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const business = isUuid(id) ? await businessById(id) : null;
  return { title: business?.businessName ?? "Site" };
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

/** The links a founder reaches for first, as buttons that say where they go. */
function Actions({ business, detail }: { business: Business; detail: SiteDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {business.previewUrl && (
        <a href={business.previewUrl} target="_blank" rel="noreferrer" className={buttonClasses("solid", "md")}>
          <Eye size={18} aria-hidden="true" />
          Open preview
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {business.siteUrl && (
        <a href={business.siteUrl} target="_blank" rel="noreferrer" className={buttonClasses("soft", "md")}>
          <Globe size={18} aria-hidden="true" />
          Open live site
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {detail.site && <OpenEditorButton slug={detail.site.slug} label="Open editor" variant="soft" />}
      <Link href={`/admin/sites/${business.id}?tab=messages`} className={buttonClasses("soft", "md")}>
        <ChatsCircle size={18} aria-hidden="true" />
        {detail.thread.length > 0 ? "Conversation" : "Email them"}
      </Link>
    </div>
  );
}

/** Where this business's build is: running with an ETA, waiting in the queue, abandoned, or the controls to start one. */
async function BuildCard({ business, detail }: { business: Business; detail: SiteDetail }) {
  const build = detail.build;
  if (build?.kind === "current") {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Link href="/admin/builds" className="text-ink-soft w-fit text-sm font-medium hover:underline">
          Building now on {build.job.runnerName}
        </Link>
        <BuildProgress step={build.job.step} eta={build.job.eta} now={detail.now} />
      </Card>
    );
  }
  if (build?.kind === "queued") {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <span>
          <span className="font-semibold">Queued, #{build.position}</span>
          <span className="text-ink-soft"> starts around {clockTime(build.job.startsAt, detail.now)}</span>
        </span>
        <Link href="/admin/builds" className="text-ink-soft text-sm font-medium hover:underline">
          See the queue
        </Link>
      </Card>
    );
  }
  if (build?.kind === "abandoned") {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <StatusMark icon={WarningCircle} tone="warn" label="Build abandoned" detail="The runner moved on without finishing it." />
        <Link href="/admin/builds" className={buttonClasses("soft", "sm")}>
          Put it back on Builds
        </Link>
      </Card>
    );
  }
  return <PreviewBuild lead={business} job={await activeJobFor(business.id)} command={buildCommand(business)} />;
}

function NeedsYou({ detail }: { detail: SiteDetail }) {
  if (detail.flags.length + detail.spotChecks.length === 0) return null;
  return (
    <Section title="Needs you" count={detail.flags.length + detail.spotChecks.length}>
      {detail.flags.map((row) => (
        <FlagCard key={row.flag.id} row={row} />
      ))}
      {detail.spotChecks.map((row) => (
        <SpotCheckCard key={row.check.id} row={row} />
      ))}
    </Section>
  );
}

function Overview({ business, detail }: { business: Business; detail: SiteDetail }) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <NeedsYou detail={detail} />
        <BuildCard business={business} detail={detail} />
        {business.emailProblem && (
          <Section title="Problem line">
            <p className="text-ink-soft max-w-prose text-pretty">{business.emailProblem}</p>
          </Section>
        )}
        <Section title="Latest">
          <SiteHistory items={detail.history.slice(0, 6)} />
        </Section>
      </div>
      <aside className="flex flex-col gap-6">
        <PreviewThumb url={business.previewUrl} name={business.businessName} />
        <KeyValue rows={facts(business)} />
      </aside>
    </div>
  );
}

function Details({ business, detail }: { business: Business; detail: SiteDetail }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Card className="p-5">
        <LeadForm business={business} />
      </Card>
      <BrandFiles leadId={business.id} files={detail.brand} canUpload={Boolean(env.brandFilesToken())} />
    </div>
  );
}

function TabBody({ tab, business, detail }: { tab: Tab; business: Business; detail: SiteDetail }) {
  if (tab === "messages") {
    return detail.thread.length === 0 ? <p className="text-ink-faint">No emails yet</p> : <Conversation business={business} thread={detail.thread} heading={false} />;
  }
  if (tab === "history") return <SiteHistory items={detail.history} />;
  if (tab === "details") return <Details business={business} detail={detail} />;
  return <Overview business={business} detail={detail} />;
}

/** An old Sites address used the live site's slug; those pages live under Sites > live now. */
async function slugRedirect(id: string) {
  const site = await clientSite(id);
  if (site) redirect(`/admin/sites/live/${encodeURIComponent(site.slug)}`);
  notFound();
}

export default async function SitePage({ params, searchParams }: Params) {
  const { id } = await params;
  if (!isUuid(id)) await slugRedirect(id);
  const business = await businessById(id);
  if (!business) notFound();
  const requested = (await searchParams).tab as Tab;
  const tab = TABS.includes(requested) ? requested : "overview";
  const detail = await siteDetail(business);
  if (tab === "messages") await markThreadRead(business.id);
  const status = leadStatus(business.stage, detail.jobs[0]?.status ?? null, detail.jobs[0]?.step ?? "");
  const base = `/admin/sites/${business.id}`;

  return (
    <>
      <Link href="/admin/sites" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Sites
      </Link>
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h1 className="font-display text-5xl leading-none font-black break-words">{business.businessName}</h1>
          <span className="text-lg">
            <LeadStatusMark status={status} />
          </span>
          <ArmChip arm={business.priceArm} />
        </div>
        <Card className="px-4 pt-5 pb-3">
          <JourneyStrip business={business} />
        </Card>
        <Actions business={business} detail={detail} />
      </header>
      <PageTabs
        label="Site views"
        current={tab === "overview" ? base : `${base}?tab=${tab}`}
        tabs={[
          { href: base, label: "Overview" },
          { href: `${base}?tab=messages`, label: "Messages", count: detail.thread.length },
          { href: `${base}?tab=history`, label: "History", count: detail.history.length },
          { href: `${base}?tab=details`, label: "Details" },
        ]}
      />
      <TabBody tab={tab} business={business} detail={detail} />
    </>
  );
}
