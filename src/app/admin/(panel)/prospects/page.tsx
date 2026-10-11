import { ArrowSquareOut, CaretLeft, CaretRight, EnvelopeSimple, InstagramLogo, Phone } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import FilterBar from "@/components/admin/FilterBar";
import { controlClass } from "@/components/admin/fields";
import { Card, KeyValue, PageHeader, When } from "@/components/admin/ui";
import { scoreTone, signalLabel } from "@/lib/prospects";
import type { Prospect } from "@/server/db/schema";
import { PROSPECT_SORTS, PROSPECTS_PER_PAGE, prospectFacets, searchProspects, type ProspectFilters, type ProspectSort } from "@/server/prospects";

export const metadata: Metadata = { title: "Prospects" };

type Search = Record<string, string | string[] | undefined>;

const LEAD_OPTIONS: [string, string][] = [
  ["", "Lead or not"],
  ["yes", "Already a lead"],
  ["no", "Not a lead yet"],
];

const number = new Intl.NumberFormat("en-US");

function value(search: Search, name: string) {
  const raw = search[name];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
}

function score(search: Search, name: string) {
  const raw = value(search, name);
  if (!raw) return null;
  const parsed = Math.round(Number(raw));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
}

function readFilters(search: Search): ProspectFilters {
  const sort = value(search, "sort");
  const lead = value(search, "lead");
  return {
    q: value(search, "q"),
    niche: value(search, "niche"),
    area: value(search, "area"),
    platform: value(search, "platform"),
    signal: value(search, "signal"),
    minScore: score(search, "min"),
    maxScore: score(search, "max"),
    hasEmail: value(search, "email") === "1",
    lead: lead === "yes" || lead === "no" ? lead : "",
    sort: PROSPECT_SORTS.some(([option]) => option === sort) ? (sort as ProspectSort) : "newest",
    page: Math.max(1, Math.floor(Number(value(search, "page")) || 1)),
  };
}

/** The filters as URL values, for links that change one thing. */
function params(filters: ProspectFilters, change: Partial<Record<string, string>> = {}) {
  const all: Record<string, string> = {
    q: filters.q,
    niche: filters.niche,
    area: filters.area,
    platform: filters.platform,
    signal: filters.signal,
    min: filters.minScore?.toString() ?? "",
    max: filters.maxScore?.toString() ?? "",
    email: filters.hasEmail ? "1" : "",
    lead: filters.lead,
    sort: filters.sort === "newest" ? "" : filters.sort,
    page: filters.page > 1 ? String(filters.page) : "",
    ...change,
  };
  return new URLSearchParams(Object.entries(all).filter(([, entry]) => entry));
}

const options = (all: string, values: string[], label: (entry: string) => string = (entry) => entry): [string, string][] => [["", all], ...values.map((entry): [string, string] => [entry, label(entry)])];

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
      {children}
      <ArrowSquareOut size={14} className="shrink-0" aria-hidden="true" />
    </a>
  );
}

function LinkList({ urls }: { urls: string[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {urls.map((url) => (
        <li key={url}>
          <ExternalLink href={url}>{url.replace(/^https?:\/\/(www\.)?/, "")}</ExternalLink>
        </li>
      ))}
    </ul>
  );
}

type SignalDetail = { name: string; points?: number; plain?: string; detail?: string };

function signalDetails(prospect: Prospect): SignalDetail[] {
  const fromAudit = prospect.audit.signal_details;
  if (Array.isArray(fromAudit)) return fromAudit as SignalDetail[];
  return prospect.signals.map((name) => ({ name }));
}

function Signals({ prospect }: { prospect: Prospect }) {
  const details = signalDetails(prospect);
  if (details.length === 0) return <span className="text-ink-faint">None found</span>;
  return (
    <ul className="flex flex-col gap-1">
      {details.map((signal) => (
        <li key={signal.name} className="text-pretty">
          <span className="font-medium">{signal.plain ? signal.plain.charAt(0).toUpperCase() + signal.plain.slice(1) : signalLabel(signal.name)}</span>
          {signal.points !== undefined && <span className="text-ink-faint tabular-nums"> −{signal.points}</span>}
          {signal.detail && <span className="text-ink-soft"> · {signal.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

const kilobytes = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`);

function facts(prospect: Prospect): [string, ReactNode][] {
  const rows: [string, ReactNode][] = [];
  const add = (label: string, shown: ReactNode, when: unknown = shown) => {
    if (when !== "" && when !== null && when !== undefined && !(Array.isArray(when) && when.length === 0)) rows.push([label, shown]);
  };
  add("Website", <ExternalLink href={prospect.website}>{prospect.website.replace(/^https?:\/\/(www\.)?/, "")}</ExternalLink>, prospect.website);
  add("Google Maps", <ExternalLink href={`https://www.google.com/maps/place/?q=place_id:${prospect.placeId}`}>Open</ExternalLink>, prospect.placeId);
  add("Emails", prospect.emails.join(", ") || prospect.email, prospect.emails.length ? prospect.emails : prospect.email);
  add("Instagram", <ExternalLink href={`https://instagram.com/${prospect.instagram}`}>@{prospect.instagram}</ExternalLink>, prospect.instagram);
  add("Phone", prospect.phone);
  add("Address", prospect.address);
  const social = Object.values(prospect.socialLinks);
  add("Social", <LinkList urls={social} />, social);
  add("Reviews", <LinkList urls={prospect.reviewLinks} />, prospect.reviewLinks);
  add("Booking", <LinkList urls={prospect.bookingLinks} />, prospect.bookingLinks);
  add("Ordering", <LinkList urls={prospect.orderingLinks} />, prospect.orderingLinks);
  add("Page title", prospect.pageTitle);
  add("Description", prospect.metaDescription);
  add("Copyright year", prospect.copyrightYear);
  add("Pages linked", prospect.pageCount);
  const speed = [
    prospect.serverMs !== null ? `server answered in ${number.format(prospect.serverMs)} ms` : "",
    prospect.loadMs !== null ? `loaded on a phone in ${(prospect.loadMs / 1000).toFixed(1)} s` : "",
    prospect.pageBytes !== null ? kilobytes(prospect.pageBytes) : "",
  ].filter(Boolean);
  add("Speed", speed.join(", "), speed.join(""));
  add("Note", String(prospect.audit.note ?? ""));
  rows.push(["Problems", <Signals key="signals" prospect={prospect} />]);
  rows.push(["Last audited", <When key="audited" date={prospect.updatedAt} />]);
  return rows;
}

function ContactIcons({ prospect }: { prospect: Prospect }) {
  const icons = [
    { has: Boolean(prospect.email), icon: EnvelopeSimple, label: "Email" },
    { has: Boolean(prospect.instagram), icon: InstagramLogo, label: "Instagram" },
    { has: Boolean(prospect.phone), icon: Phone, label: "Phone" },
  ];
  return (
    <span className="flex items-center gap-1.5">
      {icons.map(({ has, icon: Icon, label }) => (
        <span key={label} title={has ? label : `No ${label.toLowerCase()} found`} className={has ? "text-ink" : "text-ink/15"}>
          <Icon size={16} weight={has ? "fill" : "regular"} aria-hidden="true" />
          <span className="sr-only">{has ? `Has ${label.toLowerCase()}` : `No ${label.toLowerCase()}`}</span>
        </span>
      ))}
    </span>
  );
}

function ProspectRow({ prospect }: { prospect: Prospect }) {
  return (
    <li className="border-ink/8 border-b last:border-b-0">
      <details className="group/row">
        <summary className="hover:bg-paper/70 grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_3.5rem_4.5rem_7.5rem] [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <CaretRight size={12} className="text-ink-faint shrink-0 transition-transform duration-150 group-open/row:rotate-90" aria-hidden="true" />
              <span className="truncate font-medium">{prospect.businessName || prospect.domain || "No name found"}</span>
              {prospect.businessId && <span className="bg-ink/8 shrink-0 rounded-full px-2 py-px text-xs font-medium">Lead</span>}
            </span>
            <span className="text-ink-faint truncate ps-[18px]">{prospect.domain || "No website"}</span>
          </span>
          <span className={`text-right tabular-nums md:order-4 ${scoreTone(prospect.siteScore)}`}>
            {prospect.siteScore ?? "–"}
            <span className="sr-only"> out of 100</span>
          </span>
          <span className="text-ink-soft truncate ps-[18px] md:order-2 md:ps-0">{[prospect.niche, prospect.area].filter(Boolean).join(", ") || "Added by hand"}</span>
          <span className="text-ink-soft hidden truncate md:order-3 md:block">{prospect.platform || "–"}</span>
          <span className="hidden md:order-5 md:block">
            <ContactIcons prospect={prospect} />
          </span>
          <span className="text-ink-faint hidden text-right md:order-6 md:block">
            <When date={prospect.foundAt} />
          </span>
        </summary>
        <div className="flex flex-col gap-3 px-4 pt-1 pb-4 ps-[34px]">
          <KeyValue rows={facts(prospect)} />
          {prospect.businessId && (
            <Link href={`/admin/pipeline/${prospect.businessId}`} className={buttonClasses("soft", "sm", "w-fit")}>
              Open the lead
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}

function Pages({ filters, total }: { filters: ProspectFilters; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PROSPECTS_PER_PAGE));
  if (pages === 1) return null;
  const link = (page: number) => `/admin/prospects?${params(filters, { page: page > 1 ? String(page) : "" })}`;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      {filters.page > 1 ? (
        <Link href={link(filters.page - 1)} className={buttonClasses("soft", "sm")}>
          <CaretLeft size={14} aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-faint tabular-nums">
        Page {filters.page} of {pages}
      </span>
      {filters.page < pages ? (
        <Link href={link(filters.page + 1)} className={buttonClasses("soft", "sm")}>
          Next <CaretRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = readFilters(await searchParams);
  const [{ rows, total }, facets] = await Promise.all([searchProspects(filters), prospectFacets()]);
  const first = (filters.page - 1) * PROSPECTS_PER_PAGE + 1;
  const filtered = params({ ...filters, sort: "newest", page: 1 }).size > 0;

  return (
    <>
      <PageHeader title="Prospects" />
      <p className="text-ink-soft -mt-4 max-w-prose text-pretty">
        Every business the lead finder has audited, lead or not, with everything found on its own website. Search it before picking a new niche or area.
      </p>
      <FilterBar
        action="/admin/prospects"
        search={{ name: "q", value: filters.q, placeholder: "Name, website, email, phone, address…", label: "Search prospects" }}
        selects={[
          { name: "niche", label: "Niche", value: filters.niche, options: options("Any niche", facets.niches) },
          { name: "area", label: "Area", value: filters.area, options: options("Any area", facets.areas) },
          { name: "platform", label: "Platform", value: filters.platform, options: options("Any platform", facets.platforms) },
          { name: "signal", label: "Problem", value: filters.signal, options: options("Any problem", facets.signals, signalLabel) },
          { name: "lead", label: "Lead or not", value: filters.lead, options: LEAD_OPTIONS },
          { name: "sort", label: "Sort", value: filters.sort, options: PROSPECT_SORTS.map(([option, label]): [string, string] => [option, label]) },
        ]}
        clearHref={filtered ? "/admin/prospects" : undefined}
      >
        <span className="flex items-center gap-1.5 text-sm">
          <label htmlFor="min" className="text-ink-soft">
            Score
          </label>
          <input id="min" name="min" type="number" min={0} max={100} placeholder="min" defaultValue={filters.minScore ?? ""} aria-label="Lowest score" className={`${controlClass} min-h-9 w-16 px-2 py-1 text-sm`} />
          <span className="text-ink-faint">to</span>
          <input name="max" type="number" min={0} max={100} placeholder="max" defaultValue={filters.maxScore ?? ""} aria-label="Highest score" className={`${controlClass} min-h-9 w-16 px-2 py-1 text-sm`} />
        </span>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="email" value="1" defaultChecked={filters.hasEmail} className="accent-ink size-4" />
          Has an email
        </label>
      </FilterBar>
      {total === 0 ? (
        <EmptyState title={filtered ? "No prospect matches" : "No prospects yet"}>
          {filtered ? (
            "Try fewer filters."
          ) : (
            <>
              Run the lead finder with <code className="font-mono">DEFECT_ADMIN_URL</code> and <code className="font-mono">DEFECT_ENGINE_TOKEN</code> set, and every business it audits lands here.
            </>
          )}
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-3" aria-label="Prospects">
          <p className="text-ink-faint text-sm" role="status">
            {number.format(first)}–{number.format(first + rows.length - 1)} of {number.format(total)}
          </p>
          <Card className="overflow-hidden">
            <div className="text-ink-faint border-ink/10 hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_3.5rem_4.5rem_7.5rem] gap-x-4 border-b px-4 py-2.5 text-sm md:grid" aria-hidden="true">
              <span className="ps-[18px]">Business</span>
              <span>Niche and area</span>
              <span>Platform</span>
              <span className="text-right">Score</span>
              <span>Contact</span>
              <span className="text-right">Found</span>
            </div>
            <ul>
              {rows.map((prospect) => (
                <ProspectRow key={prospect.id} prospect={prospect} />
              ))}
            </ul>
          </Card>
          <Pages filters={filters} total={total} />
        </section>
      )}
    </>
  );
}
