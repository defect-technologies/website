import { ArrowUpRight, Clock, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import { Notice } from "@/components/admin/ui";
import { BusiestTimes, InsightCards, RangePicker, RankedList, ReachedYou, VisitorsCard } from "@/components/portal/Dashboard";
import PortalShell from "@/components/portal/PortalShell";
import { hasAnyData, insights, parseRange } from "@/lib/siteAnalytics";
import { siteName } from "@/server/editor/signInLinks";
import { siteAnalytics } from "@/server/integrations/webAnalytics";
import GoingLiveSteps from "@/components/portal/GoingLive";
import { analyticsProject, isOwnerOf, portalContext } from "@/server/portal/context";
import { goingLiveFor, isFinished, type GoingLive } from "@/server/portal/goingLive";
import { isLive, type PortalSite } from "@/server/sites/clientSites";

export const metadata: Metadata = { title: "Dashboard" };

function SiteHeading({ site, name }: { site: PortalSite; name: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{name}</h1>
      {isLive(site) && (
        <a href={site.url} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink inline-flex items-center gap-1 self-start underline decoration-ink/20 underline-offset-4">
          {new URL(site.url).host}
          <ArrowUpRight size={14} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

/** Before launch there are no numbers yet: the page is the checklist for getting the website live. */
function BeforeLaunch({ context, going, name }: { context: Awaited<ReturnType<typeof portalContext>>; going: GoingLive | null; name: string }) {
  return (
    <PortalShell context={context} path="/portal">
      <SiteHeading site={context.site} name={name} />
      {going ? (
        <GoingLiveSteps going={going} slug={context.site.slug} name={name} />
      ) : (
        <p className="text-ink-soft flex items-start gap-2 text-pretty">
          <Clock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          This website isn&apos;t live yet. You can edit it once it is.
        </p>
      )}
    </PortalShell>
  );
}

export default async function PortalDashboard({ searchParams }: { searchParams: Promise<{ site?: string; days?: string }> }) {
  const query = await searchParams;
  const context = await portalContext(query.site);
  const { site } = context;
  const name = siteName(site.businessName, site.url);
  const going = site.businessId ? await goingLiveFor(site) : null;
  if (!isLive(site)) return <BeforeLaunch context={context} going={going} name={name} />;
  const days = parseRange(query.days);
  const analytics = await siteAnalytics(analyticsProject(site), days);
  if (analytics.state !== "ok") console.error(`[portal] Analytics for ${site.slug} unavailable`, analytics);
  const several = context.sites.length > 1;

  return (
    <PortalShell context={context} path="/portal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SiteHeading site={site} name={name} />
        <RangePicker days={days} site={several ? site.slug : undefined} />
      </div>
      {going && !isFinished(going) && <GoingLiveSteps going={going} slug={site.slug} name={name} />}
      {analytics.state !== "ok" && <Notice tone="warn">Your numbers can&apos;t be loaded right now. Check back in a little while.</Notice>}
      {analytics.state === "ok" && !hasAnyData(analytics.data) && (
        <p className="text-ink-soft flex items-start gap-2 text-pretty">
          <Clock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          No data yet. Your numbers fill in here as people find and use your website.
        </p>
      )}
      {analytics.state === "ok" && (
        <>
          <InsightCards items={insights(analytics.data, days)} />
          <ReachedYou analytics={analytics.data} days={days} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RankedList title="Pages people reached you from" rows={analytics.data.actionPages} unit="people" />
            <RankedList title="Where those customers came from" rows={analytics.data.actionSources} unit="people" />
          </div>
          <VisitorsCard analytics={analytics.data} days={days} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RankedList title="Most visited pages" rows={analytics.data.pages} unit="visitors" />
            <RankedList title="Where visitors came from" rows={analytics.data.sources} unit="visitors" />
          </div>
          <BusiestTimes week={analytics.data.week} />
        </>
      )}
      <BiggerChanges site={site} name={name} />
    </PortalShell>
  );
}

/** We take change requests from the owner only, so an editor is pointed to them instead. */
function BiggerChanges({ site, name }: { site: PortalSite; name: string }) {
  if (!isOwnerOf(site)) {
    return <p className="text-ink-soft pt-2 text-pretty">For changes the editor can&apos;t make, ask {site.ownerEmail}, who owns this website, to email us.</p>;
  }
  const changeEmail = `mailto:hello@defect.tech?subject=${encodeURIComponent(`A change to ${name}`)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
      <p className="text-ink-soft">Want something changed that the editor can&apos;t do?</p>
      <a href={changeEmail} className={buttonClasses("soft", "sm")}>
        <EnvelopeSimple size={16} aria-hidden="true" />
        Email us a change
      </a>
    </div>
  );
}
