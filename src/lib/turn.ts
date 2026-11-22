// A founder's turns: everything that waits for their taste, as one list at the top of To do. A design to choose and a
// built site to look at are the same kind of work for a founder with a phone and two minutes, so they sit together.

/** Where the list lives: To do. The home screen icon opens it, and every decision on a design or a review comes back to it. */
export const TURN_PATH = "/admin";

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

/** Where a turn opens: a founder's Designs and Review, or a designer's own. */
export type TurnPaths = { design: (boardId: string) => string; review: (businessId: string) => string };

export const FOUNDER_TURN_PATHS: TurnPaths = { design: (id) => `/admin/designs/${id}`, review: (id) => `/admin/review?id=${id}` };

const siteTurn = (kind: "repair" | "review", site: WaitingSite, paths: TurnPaths): Turn => ({ kind, href: paths.review(site.id), firstScreens: [], ...site });

const designTurn = (design: WaitingDesign, paths: TurnPaths): Turn => ({ kind: "design", href: paths.design(design.id), previewUrl: "", held: false, ...design });

/**
 * The list's order. A repair comes first: a founder asked for it minutes ago and still has the site in mind. Then
 * designs, because a build waits for each one. Then the sites no founder has looked at yet.
 */
export function turnsInOrder(repaired: WaitingSite[], designs: WaitingDesign[], sites: WaitingSite[], paths: TurnPaths = FOUNDER_TURN_PATHS): Turn[] {
  const repairedIds = new Set(repaired.map((site) => site.id));
  return [
    ...repaired.map((site) => siteTurn("repair", site, paths)),
    ...designs.map((design) => designTurn(design, paths)),
    ...sites.filter((site) => !repairedIds.has(site.id)).map((site) => siteTurn("review", site, paths)),
  ];
}
