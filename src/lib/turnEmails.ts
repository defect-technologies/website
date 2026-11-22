// The emails that tell the founders it is their turn: three designs wait for a choice, or a built site waits for a
// look. Only the first thing to wait on the To do page is emailed; what follows gathers there without an email.

export type TurnEmail = { subject: string; body: string };

/** The last line of an email about To do: why no email follows for the next ones. */
const quietUntilCleared = (list: string) => `Designs and sites that come after this one wait on the To do page without an email, until you have cleared it: ${list}`;

export function designsWaitEmail(business: string, options: { letter: string; name: string }[], link: string, list: string): TurnEmail {
  const names = options.map((option) => `${option.letter.toUpperCase()}. ${option.name}`);
  return {
    subject: `Choose a design for ${business}`,
    body: [`Three designs for ${business} are ready.`, names.join("\n"), `Choose one: ${link}`, "The build starts when one of you has chosen.", quietUntilCleared(list)].join("\n\n"),
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

/** `list` is To do's address, for a site that waits there; null for one answered by its flag on To do. */
export function previewWaitsEmail({ business, build, wait, link, list }: { business: string; build: BuildKind; wait: PreviewWait; link: string; list: string | null }): TurnEmail {
  const lines = [WHAT_HAPPENED[build](business), ...(wait ? [WHY_IT_WAITS[wait]] : []), `Review it: ${link}`, ...(list ? [quietUntilCleared(list)] : [])];
  return { subject: `Review the site for ${business}`, body: lines.join("\n\n") };
}
