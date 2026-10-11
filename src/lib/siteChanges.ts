import { BOT_LABEL, type Bot } from "./bots";
import { founderName, FOUNDER_EMAILS } from "./founders";

/** Who made a change to a client site, as the Site changes card groups them. */
export type ChangeAuthor = "owner" | "bot" | "founder" | "launch" | "someone";

export const CHANGE_AUTHOR_LABEL: Record<ChangeAuthor, string> = {
  owner: "Owners",
  bot: "Bots",
  founder: "Founders",
  launch: "Launch content",
  someone: "Someone else",
};

/** site-kit loads a site's first content as the author "seed.json" when it launches. */
const LAUNCH_ACTORS = new Set(["seed.json"]);

export function authorOf(actor: string, ownerEmails: Set<string>): ChangeAuthor {
  if (LAUNCH_ACTORS.has(actor)) return "launch";
  if (actor.startsWith("bot:")) return "bot";
  const email = actor.trim().toLowerCase();
  if (FOUNDER_EMAILS.includes(email)) return "founder";
  if (ownerEmails.has(email)) return "owner";
  return "someone";
}

/** "the owner", "the Client care bot", "Boris". site-kit writes bots as bot:client-care. */
export function authorName(actor: string, author: ChangeAuthor): string {
  if (author === "owner") return "the owner";
  if (author === "founder") return founderName(actor);
  if (author === "bot") {
    const bot = actor.slice("bot:".length).replaceAll("-", "_") as Bot;
    return BOT_LABEL[bot] ? `the ${BOT_LABEL[bot]} bot` : `the ${actor.slice("bot:".length).replaceAll("-", " ")} bot`;
  }
  return actor;
}

/** site-kit's document keys in words: "modules" holds hours, contact, services and the rest. */
export function documentName(key: string): string {
  if (key === "modules") return "business details";
  if (key === "theme") return "colors and fonts";
  if (!key.startsWith("page:")) return key;
  const path = key.slice("page:".length);
  if (path === "/" || path === "") return "home page";
  const last = path.split("/").filter(Boolean).pop() ?? path;
  return `${last.replaceAll("-", " ")} page`;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One plain sentence for a change (or a run of them saved together):
 * "Business details updated by the owner", "Draft of the about page saved by the Client care bot".
 */
export function describeChange({ keys, action, actor, author, summary }: { keys: string[]; action: string; actor: string; author: ChangeAuthor; summary: string }): string {
  const who = authorName(actor, author);
  if (author === "launch") return keys.length > 1 ? `Launch content loaded (${keys.length} parts)` : `Launch content loaded: ${documentName(keys[0] ?? "")}`;
  if (summary) return `${capitalize(summary)}, by ${who}`;
  const things = listOf([...new Set(keys.map(documentName))]);
  if (action === "published") return `${capitalize(things)} updated by ${who}`;
  if (action === "saved a draft") return `Draft of ${things} saved by ${who}`;
  if (action === "deleted") return `${capitalize(things)} removed by ${who}`;
  return `${capitalize(things)}: ${action} by ${who}`;
}

/** Live, draft or removed, for the chip next to a change. */
export function changeState(action: string): "Live" | "Draft" | "Removed" | "" {
  if (action === "published") return "Live";
  if (action === "saved a draft") return "Draft";
  if (action === "deleted") return "Removed";
  return "";
}

type Change = { id: number; site: string; key: string; actor: string; action: string; summary: string; at: Date };
export type ChangeGroup = { id: number; site: string; actor: string; action: string; summary: string; keys: string[]; at: Date };

/** How far apart saves by the same person on the same site can be and still read as one change. */
const SAME_SAVE_MS = 5 * 60 * 1000;

/** Folds runs of saves by the same person on the same site (newest first in, newest first out). */
export function groupChanges(changes: Change[]): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  for (const change of changes) {
    const last = groups[groups.length - 1];
    const joins = last && !change.summary && !last.summary && last.site === change.site && last.actor === change.actor && last.action === change.action && last.at.getTime() - change.at.getTime() <= SAME_SAVE_MS;
    if (joins) {
      if (!last.keys.includes(change.key)) last.keys.push(change.key);
    } else {
      groups.push({ id: change.id, site: change.site, actor: change.actor, action: change.action, summary: change.summary, keys: [change.key], at: change.at });
    }
  }
  return groups;
}
