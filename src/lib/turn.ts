// Your turn: everything that waits for a founder's taste, as one list. A design to choose and a built site to look at
// are the same kind of work for a founder with a phone and two minutes, so they sit on one page.

/** Where the list lives. The home screen icon opens it, and every decision on Designs or Review comes back to it. */
export const TURN_PATH = "/admin/turn";

/** What waits, in the order a founder takes it. */
export const TURN_KINDS = ["repair", "design", "review"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

export type Turn = {
  kind: TurnKind;
  /** The board's ID for a design, the lead's for a site. */
  id: string;
  href: string;
  businessName: string;
  /** A design's three first screens on a desktop. Empty for a site. */
  firstScreens: string[];
  /** A site's preview. Empty for a design. */
  previewUrl: string;
  /** The outside reviewer wanted changes, so the site waits on a founder before outreach. */
  held: boolean;
  since: Date | null;
};

export type WaitingDesign = { id: string; businessName: string; firstScreens: string[]; since: Date | null };
export type WaitingSite = { id: string; businessName: string; previewUrl: string; held: boolean; since: Date | null };

const siteTurn = (kind: "repair" | "review", site: WaitingSite): Turn => ({ kind, href: `/admin/review?id=${site.id}`, firstScreens: [], ...site });

const designTurn = (design: WaitingDesign): Turn => ({ kind: "design", href: `/admin/designs/${design.id}`, previewUrl: "", held: false, ...design });

/**
 * The list's order. A repair comes first: a founder asked for it minutes ago and still has the site in mind. Then
 * designs, because a build waits for each one. Then the sites no founder has looked at yet.
 */
export function turnsInOrder(repaired: WaitingSite[], designs: WaitingDesign[], sites: WaitingSite[]): Turn[] {
  const repairedIds = new Set(repaired.map((site) => site.id));
  return [
    ...repaired.map((site) => siteTurn("repair", site)),
    ...designs.map(designTurn),
    ...sites.filter((site) => !repairedIds.has(site.id)).map((site) => siteTurn("review", site)),
  ];
}
