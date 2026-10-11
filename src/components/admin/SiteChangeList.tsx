import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { authorOf, CHANGE_AUTHOR_LABEL, changeState, describeChange, groupChanges, type ChangeAuthor, type ChangeGroup } from "@/lib/siteChanges";
import type { SiteChange } from "@/server/integrations/siteChanges";
import ShowMore from "./ShowMore";
import { When } from "./ui";

/** What the admin knows about a client site, by its slug. */
export type SiteInfo = { name: string; url: string; ownerEmails: string[] };

export type ChangeFilters = { q: string; who: string; days: string };

export const CHANGE_AUTHORS: [string, string][] = [["", "Anyone"], ...(["owner", "bot", "founder", "launch", "someone"] as ChangeAuthor[]).map((author): [string, string] => [author, CHANGE_AUTHOR_LABEL[author]])];

const STATE_TONE = { Live: "bg-good/10 text-good", Draft: "bg-paper-shade text-ink-soft", Removed: "bg-bad/10 text-bad", "": "" };

type Row = ChangeGroup & { author: ChangeAuthor; site: string; info: SiteInfo | undefined };

function ChangeRow({ row }: { row: Row }) {
  const state = changeState(row.action);
  return (
    <li className="border-ink/8 flex flex-col gap-0.5 border-b pb-3 text-sm last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.info?.url ? (
          <a href={row.info.url} target="_blank" rel="noreferrer" className="group font-medium hover:underline">
            {row.info.name}
            <ArrowSquareOut size={14} className="text-ink-faint group-hover:text-ink ml-1 inline-block align-[-2px]" aria-hidden="true" />
            <span className="sr-only"> (opens the live site in a new tab)</span>
          </a>
        ) : (
          <span className="font-medium">{row.info?.name ?? row.site}</span>
        )}
        {state && <span className={`rounded-full px-2 py-px text-xs font-medium ${STATE_TONE[state]}`}>{state}</span>}
        <span className="text-ink-faint ml-auto">
          <When date={row.at} />
        </span>
      </div>
      <span className="text-ink-soft text-pretty">{describeChange({ keys: row.keys, action: row.action, actor: row.actor, author: row.author, summary: row.summary })}</span>
    </li>
  );
}

function matches(row: Row, { q, who }: ChangeFilters) {
  if (who && row.author !== who) return false;
  if (q && !`${row.info?.name ?? ""} ${row.site}`.toLowerCase().includes(q.toLowerCase())) return false;
  return true;
}

export default function SiteChangeList({ changes, sites, filters }: { changes: SiteChange[]; sites: Map<string, SiteInfo>; filters: ChangeFilters }) {
  const filtered = Boolean(filters.q || filters.who || filters.days);
  if (changes.length === 0 && !filtered) return <p className="text-ink-soft text-sm">No site has been edited yet. Every save by an owner or a bot shows up here.</p>;
  const rows: Row[] = groupChanges(changes).map((group) => {
    const info = sites.get(group.site);
    return { ...group, info, author: authorOf(group.actor, new Set(info?.ownerEmails ?? [])) };
  });
  const shown = rows.filter((row) => matches(row, filters));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-faint text-sm" role="status">
        {filtered ? `${shown.length} ${shown.length === 1 ? "change matches" : "changes match"}` : `${rows.length} changes, newest first`}
      </p>
      {shown.length === 0 ? (
        <p className="text-ink-soft text-sm">No change matches. Try fewer filters.</p>
      ) : (
        <ShowMore items={shown.map((row) => <ChangeRow key={row.id} row={row} />)} />
      )}
    </div>
  );
}
