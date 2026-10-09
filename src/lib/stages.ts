export const STAGES = ["new", "preview_built", "sent", "clicked", "replied", "paid", "live", "lost", "opted_out"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  preview_built: "Preview built",
  sent: "Sent",
  clicked: "Clicked",
  replied: "Replied",
  paid: "Paid",
  live: "Live",
  lost: "Lost",
  opted_out: "Opted out",
};

/** The path a lead moves along. Lost and opted out sit outside it. */
export const PIPELINE: Stage[] = ["new", "preview_built", "sent", "clicked", "replied", "paid", "live"];

/** Stages a lead can only move forward from, so a late click never undoes a reply. */
export function stagesBefore(stage: Stage): Stage[] {
  return PIPELINE.slice(0, PIPELINE.indexOf(stage));
}

export const PRICE_ARMS = [59, 79] as const;
export type PriceArm = (typeof PRICE_ARMS)[number];
