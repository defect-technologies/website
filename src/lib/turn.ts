// Your turn: everything that waits for a founder's taste, as one queue. A design to choose and a built site to look
// at are the same kind of work for a founder with a phone and two minutes, so they are taken one after the other.

/** Where the queue lives. The home screen icon opens it. */
export const TURN_PATH = "/admin/turn";

/** What waits, in the order a founder takes it. */
export const TURN_KINDS = ["repair", "design", "review"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

export type Turn = { kind: TurnKind; href: string; businessName: string };

type Waiting = { id: string; businessName: string };

/**
 * The queue's order. A repair comes first: a founder asked for it minutes ago and still has the site in mind. Then
 * designs, because a build waits for each one. Then the sites no founder has looked at yet.
 */
export function turnsInOrder(repaired: Waiting[], boards: Waiting[], previews: Waiting[]): Turn[] {
  const repairedIds = new Set(repaired.map((lead) => lead.id));
  return [
    ...repaired.map((lead) => ({ kind: "repair" as const, href: `/admin/review?id=${lead.id}`, businessName: lead.businessName })),
    ...boards.map((board) => ({ kind: "design" as const, href: `/admin/designs/${board.id}`, businessName: board.businessName })),
    ...previews.filter((lead) => !repairedIds.has(lead.id)).map((lead) => ({ kind: "review" as const, href: `/admin/review?id=${lead.id}`, businessName: lead.businessName })),
  ];
}
