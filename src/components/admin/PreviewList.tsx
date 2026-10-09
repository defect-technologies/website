import { ArrowCounterClockwise, ArrowSquareOut, CaretRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { switchPreviewVersionAction } from "@/app/admin/(panel)/projects/actions";
import type { Business } from "@/server/db/schema";
import { PREVIEW_LIFETIME_DAYS, type PreviewDeployment } from "@/server/integrations/vercel";
import CopyLinkButton from "./CopyLinkButton";
import SubmitButton from "./SubmitButton";

type PreviewSite = { key: string; versions: PreviewDeployment[]; owner: Business | undefined };

const builtAt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const normalize = (url: string) => url.replace(/\/$/, "");

function daysLeft(created: Date) {
  return Math.max(0, PREVIEW_LIFETIME_DAYS - Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

function Lifetime({ createdAt, className }: { createdAt: Date; className: string }) {
  const left = daysLeft(createdAt);
  return (
    <span className={`text-sm tabular-nums ${left <= 5 ? "text-warn font-medium" : "text-ink-faint"} ${className}`}>
      {left === 0 ? "Deleted at the next cleanup" : `${left} days left`}
    </span>
  );
}

/** Keeps the open-in-new-tab icon on the same line as the title's last word. */
function TitleLink({ url, title }: { url: string; title: string }) {
  const lastSpace = title.lastIndexOf(" ");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group font-medium text-pretty hover:underline">
      {title.slice(0, lastSpace + 1)}
      <span className="whitespace-nowrap">
        {title.slice(lastSpace + 1)}
        <ArrowSquareOut size={16} className="text-ink-faint group-hover:text-ink ml-1.5 inline-block align-[-2px]" aria-hidden="true" />
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function InEmails() {
  return (
    <span className="text-good inline-flex items-center gap-1 text-sm font-medium">
      <CheckCircle size={16} weight="fill" aria-hidden="true" />
      Linked in emails
    </span>
  );
}

function UseVersionButton({ owner, url }: { owner: Business; url: string }) {
  return (
    <form action={switchPreviewVersionAction}>
      <input type="hidden" name="businessId" value={owner.id} />
      <input type="hidden" name="url" value={url} />
      <SubmitButton size="sm" variant="soft" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
        Use in emails
      </SubmitButton>
    </form>
  );
}

function isLinked(owner: Business | undefined, version: PreviewDeployment) {
  return Boolean(owner) && normalize(owner!.previewUrl) === normalize(version.url);
}

function EarlierVersion({ version, owner }: { version: PreviewDeployment; owner: Business | undefined }) {
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
      <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} className="transition-transform duration-150 group-open/versions:rotate-90" aria-hidden="true" />
        {earlier.length === 1 ? "1 earlier version" : `${earlier.length} earlier versions`}
      </summary>
      <ul className="mt-2 flex flex-col gap-2 ps-5">
        {earlier.map((version) => (
          <EarlierVersion key={version.id} version={version} owner={site.owner} />
        ))}
      </ul>
    </details>
  );
}

function PreviewRow({ site }: { site: PreviewSite }) {
  const latest = site.versions[0];
  const linked = isLinked(site.owner, latest);
  return (
    <li className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
        <TitleLink url={latest.url} title={latest.title} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {site.owner && (
            <Link href={`/admin/pipeline/${site.owner.id}`} className="text-ink-faint w-fit text-sm hover:underline">
              {site.owner.businessName} in the pipeline
            </Link>
          )}
          {linked && site.versions.length > 1 && <InEmails />}
          {site.owner && !linked && <UseVersionButton owner={site.owner} url={latest.url} />}
        </div>
        <EarlierVersions site={site} />
        <Lifetime createdAt={latest.createdAt} className="sm:hidden" />
      </div>
      <CopyLinkButton url={latest.url} />
      <Lifetime createdAt={latest.createdAt} className="hidden w-28 shrink-0 pt-2.5 text-right sm:block" />
    </li>
  );
}

/** The lead a preview belongs to: by the slug the builder tags deployments with, else by the link in its emails. */
function ownerOf(key: string, versions: PreviewDeployment[], leads: Business[]) {
  const bySlug = leads.find((lead) => lead.slug === key);
  if (bySlug) return bySlug;
  const urls = new Set(versions.map((version) => normalize(version.url)));
  return leads.find((lead) => lead.previewUrl && urls.has(normalize(lead.previewUrl)));
}

/** One entry per business, newest version first, newest-built business at the top. */
function groupBySite(previews: PreviewDeployment[], leads: Business[]): PreviewSite[] {
  const bySite = new Map<string, PreviewDeployment[]>();
  for (const preview of previews) bySite.set(preview.site, [...(bySite.get(preview.site) ?? []), preview]);
  return [...bySite.entries()]
    .map(([key, versions]) => {
      const sorted = versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { key, versions: sorted, owner: ownerOf(key, sorted, leads) };
    })
    .sort((a, b) => b.versions[0].createdAt.getTime() - a.versions[0].createdAt.getTime());
}

export default function PreviewList({ previews, leads }: { previews: PreviewDeployment[]; leads: Business[] }) {
  if (previews.length === 0) return <p className="text-ink-soft text-sm">No previews deployed.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {groupBySite(previews, leads).map((site) => (
        <PreviewRow key={site.key} site={site} />
      ))}
    </ul>
  );
}
