/**
 * Inbound requests: people who ask us for a website through the form on defect.tech,
 * and emails to hello@defect.tech from addresses that match no lead.
 */
export const INBOUND_SOURCES = ["form", "email"] as const;
export type InboundSource = (typeof INBOUND_SOURCES)[number];

/**
 * What an email is, as the Client care bot sorts it. Form submissions are always requests.
 * - request: someone asking us to build them a website. A founder approves it first.
 * - founder: needs a founder's answer, so it becomes a card in the review queue.
 * - bot: a question the Client care bot can answer itself.
 * - ignore: spam, newsletters, receipts and notifications.
 */
export const INBOUND_KINDS = ["unsorted", "request", "founder", "bot", "ignore"] as const;
export type InboundKind = (typeof INBOUND_KINDS)[number];

/** Kinds the bot may sort an email into. */
export const SORTED_KINDS = ["request", "founder", "bot", "ignore"] as const;
export type SortedKind = (typeof SORTED_KINDS)[number];

export const INBOUND_KIND_LABEL: Record<InboundKind, string> = {
  unsorted: "Not sorted yet",
  request: "Website request",
  founder: "Needs a founder",
  bot: "Answered by Client care",
  ignore: "Ignored",
};

/** open: still waiting on someone. accepted: a lead was made and a preview queued. */
export const INBOUND_STATUSES = ["open", "accepted", "declined", "answered", "closed"] as const;
export type InboundStatus = (typeof INBOUND_STATUSES)[number];

export const INBOUND_STATUS_LABEL: Record<InboundStatus, string> = {
  open: "Open",
  accepted: "Preview queued",
  declined: "Turned down",
  answered: "Answered",
  closed: "Closed",
};

/** The price on defect.tech's home page, which is what someone who asked us has seen. */
export const INBOUND_PRICE_ARM = 59;

export const ABOUT_LIMIT = 4000;
