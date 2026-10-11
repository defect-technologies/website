import { ArrowUpRight, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import { Notice } from "@/components/admin/ui";
import { ActionTiles, NoVisitsYet, RangePicker, RankedList, VisitorsCard } from "@/components/portal/Dashboard";
import PortalShell from "@/components/portal/PortalShell";
import { hasAnyData, parseRange } from "@/lib/siteAnalytics";
import { siteName } from "@/server/editor/signInLinks";
import { siteAnalytics } from "@/server/integrations/webAnalytics";
import { analyticsProject, portalContext } from "@/server/portal/context";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PortalDashboard({ searchParams }: { searchParams: Promise<{ site?: string; days?: string }> }) {
  const query = await searchParams;
  const context = await portalContext(query.site);
  const { site } = context;
  const days = parseRange(query.days);
  const analytics = await siteAnalytics(analyticsProject(site), days);
  if (analytics.state !== "ok") console.error(`[portal] Analytics for ${site.slug} unavailable`, analytics);
  const name = siteName(site.businessName, site.url);
  const several = context.sites.length > 1;
  const changeEmail = `mailto:hello@defect.tech?subject=${encodeURIComponent(`A change to ${name}`)}`;

  return (
    <PortalShell context={context} path="/portal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{name}</h1>
          <a href={site.url} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink inline-flex items-center gap-1 self-start underline decoration-ink/20 underline-offset-4">
            {new URL(site.url).host}
            <ArrowUpRight size={14} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <RangePicker days={days} site={several ? site.slug : undefined} />
      </div>
      {analytics.state !== "ok" && <Notice tone="warn">Your numbers can&apos;t be loaded right now. Check back in a little while.</Notice>}
      {analytics.state === "ok" && !hasAnyData(analytics.data) && <NoVisitsYet />}
      {analytics.state === "ok" && hasAnyData(analytics.data) && (
        <>
          <ActionTiles analytics={analytics.data} days={days} />
          <VisitorsCard analytics={analytics.data} days={days} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RankedList title="Most visited pages" rows={analytics.data.pages} empty="No pages viewed in this period." />
            <RankedList title="Where visitors came from" rows={analytics.data.sources} empty="No visitors in this period." />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
        <p className="text-ink-soft">Want something changed that the editor can&apos;t do?</p>
        <a href={changeEmail} className={buttonClasses("soft", "sm")}>
          <EnvelopeSimple size={16} aria-hidden="true" />
          Email us a change
        </a>
      </div>
    </PortalShell>
  );
}
