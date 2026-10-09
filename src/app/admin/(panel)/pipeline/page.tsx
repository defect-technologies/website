import { Flask } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import ArmFunnel from "@/components/admin/ArmFunnel";
import EmptyState from "@/components/admin/EmptyState";
import ImportForm from "@/components/admin/ImportForm";
import { controlClass } from "@/components/admin/fields";
import { ArmChip, Card, PageHeader, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { PIPELINE, PRICE_ARMS, STAGE_LABEL } from "@/lib/stages";
import { STAGES, type Business, type Stage } from "@/server/db/schema";
import { devShortcutsEnabled } from "@/server/env";
import { funnelByArm, listBusinesses, niches, stageCounts } from "@/server/leads/businesses";

export const metadata: Metadata = { title: "Pipeline" };

type Filters = { stage?: string; niche?: string; arm?: string };

function parseFilters({ stage, niche, arm }: Filters) {
  return {
    stage: (STAGES as readonly string[]).includes(stage ?? "") ? (stage as Stage) : ("all" as const),
    niche: niche ?? "",
    arm: arm === "59" || arm === "79" ? Number(arm) : null,
  };
}

function filterHref(current: Filters, change: Filters) {
  const params = new URLSearchParams(Object.entries({ ...current, ...change }).filter(([, value]) => value) as [string, string][]);
  const query = params.toString();
  return query ? `/admin/pipeline?${query}` : "/admin/pipeline";
}

type Tab = Stage | "all";

function StageTab({ stage, count, current, href }: { stage: Tab; count: number; current: boolean; href: string }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ink ${current ? "bg-ink text-paper font-semibold" : "text-ink-soft hover:bg-paper-shade"}`}
      >
        {stage === "all" ? "All" : STAGE_LABEL[stage]}
        <span className={`tabular-nums ${current ? "text-paper/70" : "text-ink-faint"}`}>{count}</span>
      </Link>
    </li>
  );
}

function StageTabs({ counts, filters }: { counts: Record<string, number>; filters: Filters }) {
  const tabs: Tab[] = ["all", ...PIPELINE, "lost", "opted_out"];
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const selected = filters.stage || "all";
  return (
    <nav aria-label="Filter by stage" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1">
        {tabs.map((stage) => (
          <StageTab
            key={stage}
            stage={stage}
            current={selected === stage}
            count={stage === "all" ? total : (counts[stage] ?? 0)}
            href={filterHref(filters, { stage: stage === "all" ? "" : stage })}
          />
        ))}
      </ul>
    </nav>
  );
}

function NarrowFilters({ filters, allNiches }: { filters: Filters; allNiches: string[] }) {
  return (
    <form className="flex flex-wrap items-end gap-3" action="/admin/pipeline">
      {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Niche
        <select name="niche" defaultValue={filters.niche ?? ""} className={`${controlClass} min-w-40 py-1.5 text-sm`}>
          <option value="">Every niche</option>
          {allNiches.map((niche) => (
            <option key={niche} value={niche}>
              {niche}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Price
        <select name="arm" defaultValue={filters.arm ?? ""} className={`${controlClass} min-w-28 py-1.5 text-sm`}>
          <option value="">Both</option>
          {PRICE_ARMS.map((arm) => (
            <option key={arm} value={arm}>
              ${arm}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm">
        Filter
      </Button>
    </form>
  );
}

function LeadTable({ leads }: { leads: Business[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <caption className="sr-only">Leads</caption>
        <thead className="text-ink-faint text-sm">
          <tr>
            <th scope="col" className="pb-2 font-normal">Business</th>
            <th scope="col" className="pb-2 font-normal">Niche</th>
            <th scope="col" className="pb-2 font-normal">Stage</th>
            <th scope="col" className="pb-2 font-normal">Price</th>
            <th scope="col" className="pb-2 text-right font-normal">Outdated score</th>
            <th scope="col" className="pb-2 pl-6 font-normal">Last contact</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-ink/8 hover:bg-surface border-t">
              <th scope="row" className="py-2.5 pr-4 font-medium">
                <Link href={`/admin/pipeline/${lead.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                  {lead.businessName}
                </Link>
              </th>
              <td className="text-ink-soft py-2.5 pr-4 text-sm">{lead.niche || "Unknown"}</td>
              <td className="py-2.5 pr-4">
                <StageChip stage={lead.stage} />
              </td>
              <td className="py-2.5 pr-4">
                <ArmChip arm={lead.priceArm} />
              </td>
              <td className="py-2.5 text-right tabular-nums">{lead.outdatedScore}</td>
              <td className="text-ink-soft py-2.5 pl-6 text-sm">
                <When date={lead.lastContactAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleButton() {
  return (
    <form action="/api/dev/sample" method="post">
      <Button type="submit" size="sm" variant="ghost" icon={<Flask size={16} aria-hidden="true" />}>
        Load made-up sample leads (local only)
      </Button>
    </form>
  );
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const [leads, counts, arms, allNiches] = await Promise.all([listBusinesses(parseFilters(filters)), stageCounts(), funnelByArm(), niches()]);
  const hasAny = Object.keys(counts).length > 0;

  return (
    <>
      <PageHeader title="Pipeline" />
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeading>$59 against $79</SectionHeading>
        <ArmFunnel arms={arms} />
      </Card>
      <section className="flex flex-col gap-3">
        <SectionHeading>Add leads</SectionHeading>
        <ImportForm />
        {devShortcutsEnabled && <SampleButton />}
      </section>
      {hasAny ? (
        <section className="flex flex-col gap-4">
          <StageTabs counts={counts} filters={filters} />
          <NarrowFilters filters={filters} allNiches={allNiches} />
          {leads.length > 0 ? <LeadTable leads={leads} /> : <p className="text-ink-soft">No leads match these filters.</p>}
        </section>
      ) : (
        <EmptyState title="No leads yet">Run the lead finder, then import the leads.csv it writes. Leads already here are skipped.</EmptyState>
      )}
    </>
  );
}
