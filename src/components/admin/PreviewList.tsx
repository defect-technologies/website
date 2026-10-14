import { ArrowCounterClockwise, CaretRight, CheckCircle, Kanban } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { switchPreviewVersionAction } from "@/app/admin/(panel)/setup/connections/actions";
import type { Business, Stage } from "@/server/db/schema";
import { PREVIEW_LIFETIME_DAYS, type PreviewDeployment } from "@/server/integrations/vercel";
import CopyLinkButton from "./CopyLinkButton";
import OpenPreviewsButton from "./OpenPreviewsButton";
import ShowMore from "./ShowMore";
import SubmitButton from "./SubmitButton";
import { StageChip, When } from "./ui";

export type PreviewLead = Pick<Business, "id" | "slug" | "businessName" | "previewUrl" | "stage">;
type PreviewSite = { key: string; name: string; versions: PreviewDeployment[]; owner: PreviewLead | undefined };

/** The preview filters on Leads > Previews, as their URL values. */
export const PREVIEW_STATUSES: [string, string][] = [
  ["", "Any status"],
  ["unsent", "Not sent yet"],
  ["sent", "Sent"],
  ["replied", "Replied"],
  ["client", "Paying client"],
  ["lost", "Lost or opted out"],
  ["expiring", "Expiring soon"],
  ["no-lead", "No lead"],
];

export const BUILT_WITHIN: [string, string][] = [
  ["", "Any time"],
  ["1", "Today"],
  ["7", "Past week"],
  ["30", "Past month"],
];

export type PreviewFilters = { q: string; status: string; days: string };

const STATUS_STAGES: Record<string, Stage[]> = {
  unsent: ["new", "preview_built"],
  sent: ["sent", "clicked"],
  replied: ["replied"],
  client: ["paid", "live"],
  lost: ["lost", "opted_out"],
};

const EXPIRING_DAYS = 5;
const builtAt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const normalize = (url: string) => url.replace(/\/$/, "");

function daysLeft(created: Date) {
  return Math.max(0, PREVIEW_LIFETIME_DAYS - Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

/** Only a preview about to be cleaned up says so; every other one has weeks left, and saying so on each row is noise. */
function Expiry({ createdAt }: { createdAt: Date }) {
  const left = daysLeft(createdAt);
  if (left > EXPIRING_DAYS) return null;
  return <span className="text-warn text-xs font-medium whitespace-nowrap">{left === 0 ? "Expires today" : left === 1 ? "Expires tomorrow" : `Expires in ${left} days`}</span>;
}

function InEmails() {
  return (
    <span className="text-good inline-flex items-center gap-1 text-sm font-medium">
      <CheckCircle size={16} weight="fill" aria-hidden="true" />
      Linked in emails
    </span>
  );
}

function UseVersionButton({ owner, url }: { owner: PreviewLead; url: string }) {
  return (
    <form action={switchPreviewVersionAction}>
      <input type="hidden" name="businessId" value={owner.id} />
      <input type="hidden" name="url" value={url} />
      <SubmitButton size="sm" variant="ghost" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
        Use in emails
      </SubmitButton>
    </form>
  );
}

function isLinked(owner: PreviewLead | undefined, version: PreviewDeployment) {
  return Boolean(owner) && normalize(owner!.previewUrl) === normalize(version.url);
}

function EarlierVersion({ version, owner }: { version: PreviewDeployment; owner: PreviewLead | undefined }) {
  const linked = isLinked(owner, version);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={version.url} target="_blank" rel="noreferrer" className="text-sm tabular-nums hover:underline">
        Built {builtAt.format(version.createdAt)}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <CopyLinkButton url={version.url} />
      {linked && <InEmails />}
      {owner && !linked && <UseVersionButton owner={owner} url={version.url} />}
    </li>
  );
}

function EarlierVersions({ site }: { site: PreviewSite }) {
  const earlier = site.versions.slice(1);
  if (earlier.length === 0) return null;
  return (
    <details className="group/versions">
      <summary className="text-ink-faint hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        <CaretRight size={12} className="transition-transform duration-150 group-open/versions:rotate-90" aria-hidden="true" />
        {earlier.length === 1 ? "1 earlier version" : `${earlier.length} earlier versions`}
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1.5 ps-4">
        {earlier.map((version) => (
          <EarlierVersion key={version.id} version={version} owner={site.owner} />
        ))}
      </ul>
    </details>
  );
}

/**
 * One column template for the header and every row, so each column lines up down the whole list,
 * across the folded "Show more" part too. Below 26rem the row stacks: name and links, then the facts.
 */
const COLUMNS = "@[26rem]:grid-cols-[minmax(0,1fr)_7rem_6.5rem_4.5rem]";
const ROW = `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 ${COLUMNS}`;

function PreviewHeader() {
  return (
    <div className={`${ROW} text-ink-faint border-ink/10 hidden border-b pb-2 text-xs font-medium @[26rem]:grid`} aria-hidden="true">
      <span>Business</span>
      <span>Status</span>
      <span>Built</span>
      <span className="text-right">Links</span>
    </div>
  );
}

function PreviewRow({ site }: { site: PreviewSite }) {
  const latest = site.versions[0];
  const linked = isLinked(site.owner, latest);
  const notInEmails = site.owner && !linked;
  return (
    <li className={`${ROW} border-ink/8 border-b py-2.5 last:border-b-0`}>
      <div className="flex min-w-0 flex-col gap-1">
        <a href={latest.url} target="_blank" rel="noreferrer" className="min-w-0 font-medium hover:underline">
          {site.name}
          <span className="sr-only"> preview (opens in a new tab)</span>
        </a>
        {(notInEmails || site.versions.length > 1) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {notInEmails && (
              <span className="-ms-3">
                <UseVersionButton owner={site.owner!} url={latest.url} />
              </span>
            )}
            <EarlierVersions site={site} />
          </div>
        )}
      </div>
      <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-3 text-sm @[26rem]:contents">
        <span>{site.owner ? <StageChip stage={site.owner.stage} /> : <span className="bg-paper-shade text-ink-faint inline-flex rounded-full px-2.5 py-0.5 text-sm">No lead</span>}</span>
        <span className="flex flex-col text-sm leading-tight">
          <span className="text-ink-soft whitespace-nowrap">
            <When date={latest.createdAt} />
          </span>
          <Expiry createdAt={latest.createdAt} />
        </span>
      </span>
      <span className="col-start-2 row-start-1 flex items-center justify-end @[26rem]:col-start-auto @[26rem]:row-start-auto">
        <CopyLinkButton url={latest.url} />
        {site.owner ? (
          <Link href={`/admin/sites/${site.owner.id}`} title="Open the lead" className="text-ink-faint hover:text-ink hover:bg-paper-shade grid size-9 place-items-center rounded-full">
            <Kanban size={18} aria-hidden="true" />
            <span className="sr-only">Open {site.name} in the pipeline</span>
          </Link>
        ) : (
          <span className="size-9" aria-hidden="true" />
        )}
      </span>
    </li>
  );
}

/** The lead a preview belongs to: by the slug the builder tags deployments with, else by the link in its emails. */
function ownerOf(key: string, versions: PreviewDeployment[], leads: PreviewLead[]) {
  const bySlug = leads.find((lead) => lead.slug === key);
  if (bySlug) return bySlug;
  const urls = new Set(versions.map((version) => normalize(version.url)));
  return leads.find((lead) => lead.previewUrl && urls.has(normalize(lead.previewUrl)));
}

/** For previews no lead claims: "Arroyo Plumbing | Plumber in Pasadena" and the slug "arroyo-plumbing" both read "Arroyo Plumbing". */
function shortTitle(title: string) {
  if (/^[a-z0-9-]+$/.test(title)) return title.replace(/(^|-)([a-z0-9])/g, (_, dash: string, letter: string) => `${dash ? " " : ""}${letter.toUpperCase()}`);
  return title.split(/\s+[|–—-]\s+/)[0]?.trim() || title;
}

/** One entry per business, newest version first, newest-built business at the top. */
export function groupBySite(previews: PreviewDeployment[], leads: PreviewLead[]): PreviewSite[] {
  const bySite = new Map<string, PreviewDeployment[]>();
  for (const preview of previews) bySite.set(preview.site, [...(bySite.get(preview.site) ?? []), preview]);
  return [...bySite.entries()]
    .map(([key, versions]) => {
      const sorted = versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const owner = ownerOf(key, sorted, leads);
      return { key, versions: sorted, owner, name: owner?.businessName ?? shortTitle(sorted[0].title) };
    })
    .sort((a, b) => b.versions[0].createdAt.getTime() - a.versions[0].createdAt.getTime());
}

function matches(site: PreviewSite, { q, status, days }: PreviewFilters) {
  const latest = site.versions[0];
  if (q && !`${site.name} ${site.owner?.slug ?? site.key}`.toLowerCase().includes(q.toLowerCase())) return false;
  if (days && Date.now() - latest.createdAt.getTime() > Number(days) * 86_400_000) return false;
  if (status === "no-lead") return !site.owner;
  if (status === "expiring") return daysLeft(latest.createdAt) <= EXPIRING_DAYS;
  if (STATUS_STAGES[status]) return Boolean(site.owner && STATUS_STAGES[status].includes(site.owner.stage));
  return true;
}

export default function PreviewList({ previews, leads, filters }: { previews: PreviewDeployment[]; leads: PreviewLead[]; filters: PreviewFilters }) {
  if (previews.length === 0) return <p className="text-ink-soft text-sm">No previews deployed.</p>;
  const sites = groupBySite(previews, leads);
  const shown = sites.filter((site) => matches(site, filters));
  const filtered = Boolean(filters.q || filters.status || filters.days);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-ink-faint text-sm" role="status">
          {filtered ? `${shown.length} of ${sites.length} businesses match` : `${sites.length} businesses, newest first`}
        </p>
        <OpenPreviewsButton urls={shown.map((site) => site.versions[0].url)} />
      </div>
      {shown.length === 0 ? (
        <p className="text-ink-soft text-sm">No preview matches. Try fewer filters.</p>
      ) : (
        <div className="@container">
          <PreviewHeader />
          <ShowMore className="flex flex-col" items={shown.map((site) => <PreviewRow key={site.key} site={site} />)} />
        </div>
      )}
    </div>
  );
}
