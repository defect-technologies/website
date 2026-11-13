// The emails that tell the founders it is their turn: three designs wait for a choice, or a built site waits for a
// look. Until one arrives, a founder only learns of either by opening the admin.

export type TurnEmail = { subject: string; body: string };

export function designsWaitEmail(business: string, options: { letter: string; name: string }[], link: string): TurnEmail {
  const names = options.map((option) => `${option.letter.toUpperCase()}. ${option.name}`);
  return {
    subject: `Choose a design for ${business}`,
    body: [`Three designs for ${business} are ready.`, names.join("\n"), `Choose one: ${link}`, "The build starts when one of you has chosen."].join("\n\n"),
  };
}

/** A first build, a rebuild a note asked for, or the update that lets the review page point at a preview's parts. */
export type BuildKind = "built" | "rebuilt" | "updated";

const WHAT_HAPPENED: Record<BuildKind, (business: string) => string> = {
  built: (business) => `The site for ${business} is built.`,
  rebuilt: (business) => `The site for ${business} is rebuilt with the changes its note asked for.`,
  updated: (business) => `The preview for ${business} is updated. You can now point at its parts.`,
};

/** Why the preview waits on a founder in particular, when it does. */
export type PreviewWait = "held" | "owner" | null;

const WHY_IT_WAITS: Record<Exclude<PreviewWait, null>, string> = {
  held: "The outside reviewer asked for changes, so it stays out of outreach until one of you approves it.",
  owner: "The owner still sees the earlier preview until one of you approves this one.",
};

export function previewWaitsEmail({ business, build, wait, link }: { business: string; build: BuildKind; wait: PreviewWait; link: string }): TurnEmail {
  const lines = [WHAT_HAPPENED[build](business), ...(wait ? [WHY_IT_WAITS[wait]] : []), `Review it: ${link}`];
  return { subject: `Review the site for ${business}`, body: lines.join("\n\n") };
}
