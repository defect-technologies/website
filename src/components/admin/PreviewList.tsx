import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { Business } from "@/server/db/schema";
import { PREVIEW_LIFETIME_DAYS, type PreviewDeployment } from "@/server/integrations/vercel";
import CopyLinkButton from "./CopyLinkButton";

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

function PreviewRow({ preview, owner }: { preview: PreviewDeployment; owner: Business | undefined }) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-2">
        <TitleLink url={preview.url} title={preview.title} />
        {owner && (
          <Link href={`/admin/pipeline/${owner.id}`} className="text-ink-faint w-fit text-sm hover:underline">
            {owner.businessName} in the pipeline
          </Link>
        )}
        <Lifetime createdAt={preview.createdAt} className="sm:hidden" />
      </div>
      <CopyLinkButton url={preview.url} />
      <Lifetime createdAt={preview.createdAt} className="hidden w-28 shrink-0 pt-2.5 text-right sm:block" />
    </li>
  );
}

export default function PreviewList({ previews, owners }: { previews: PreviewDeployment[]; owners: Map<string, Business> }) {
  if (previews.length === 0) return <p className="text-ink-soft text-sm">No previews deployed.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {previews
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((preview) => (
          <PreviewRow key={preview.id} preview={preview} owner={owners.get(preview.url)} />
        ))}
    </ul>
  );
}

