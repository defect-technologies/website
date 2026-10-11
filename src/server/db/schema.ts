import { sql } from "drizzle-orm";
import { boolean, date, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, index, uuid } from "drizzle-orm/pg-core";
import { BOTS, FLAG_STATUSES } from "../../lib/bots";
import type { Fixer, FlagNeeds, FlagTopic } from "../../lib/flags";
import type { InboundKind, InboundSource, InboundStatus } from "../../lib/inbound";
import { ACTIVE_JOB_STATUSES, PREVIEW_JOB_STATUSES } from "../../lib/previewJobs";
import type { SpotCheckStatus } from "../../lib/spotChecks";
import { STAGES, type Stage } from "../../lib/stages";

export { STAGES, type Stage };

export const stage = pgEnum("stage", STAGES);
export const direction = pgEnum("direction", ["out", "in"]);
export const messageKind = pgEnum("message_kind", ["first", "follow_up", "reply", "inbound", "welcome", "requested"]);

/** One row per business, from the lead finder's CSV through to a paying client. */
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: text("place_id"),
    slug: text("slug").notNull(),
    linkCode: text("link_code").notNull(),
    businessName: text("business_name").notNull(),
    website: text("website").notNull().default(""),
    email: text("email").notNull().default(""),
    ownerFirstName: text("owner_first_name").notNull().default(""),
    instagram: text("instagram").notNull().default(""),
    platform: text("platform").notNull().default(""),
    copyrightYear: integer("copyright_year"),
    outdatedScore: integer("outdated_score").notNull().default(0),
    outdatedSignals: text("outdated_signals").notNull().default(""),
    problemSummary: text("problem_summary").notNull().default(""),
    leadType: text("lead_type").notNull().default(""),
    niche: text("niche").notNull().default(""),
    area: text("area").notNull().default(""),
    foundDate: text("found_date").notNull().default(""),
    stage: stage("stage").notNull().default("new"),
    priceArm: integer("price_arm"),
    note: text("note").notNull().default(""),

    previewUrl: text("preview_url").notNull().default(""),
    emailProblem: text("email_problem").notNull().default(""),
    previewBuiltAt: timestamp("preview_built_at", { withTimezone: true }),
    previewRequestedAt: timestamp("preview_requested_at", { withTimezone: true }),
    previewRequestedBy: text("preview_requested_by").notNull().default(""),

    firstSentAt: timestamp("first_sent_at", { withTimezone: true }),
    followUpSentAt: timestamp("follow_up_sent_at", { withTimezone: true }),
    threadId: text("thread_id"),
    firstMessageHeaderId: text("first_message_header_id"),
    mailboxId: uuid("mailbox_id"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    clickCount: integer("click_count").notNull().default(0),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    plan: text("plan").notNull().default(""),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    ownerEmail: text("owner_email").notNull().default(""),
    siteUrl: text("site_url").notNull().default(""),
    vercelProjectId: text("vercel_project_id").notNull().default(""),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    dnsBackup: text("dns_backup").notNull().default(""),
    /** Where the site launches when it isn't the domain of the lead's old website, such as a defect.tech subdomain. Set by a founder. */
    launchDomain: text("launch_domain").notNull().default(""),
    /** "lead_finder" for leads we found, "request" for businesses that asked us through the form or by email. */
    source: text("source").$type<LeadSource>().notNull().default("lead_finder"),
    /** For a business with no website: what the owner told us about it, which the builder works from instead of a crawl. */
    brief: text("brief").notNull().default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("businesses_place_id").on(table.placeId),
    uniqueIndex("businesses_slug").on(table.slug),
    uniqueIndex("businesses_link_code").on(table.linkCode),
    index("businesses_stage").on(table.stage),
  ],
);

/** Gmail inboxes the admin sends from and reads. Refresh tokens are sealed with the app secret. */
export const mailboxes = pgTable("mailboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  sealedRefreshToken: text("sealed_refresh_token").notNull(),
  isSender: boolean("is_sender").notNull().default(false),
  connectedBy: text("connected_by").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  /** Kept apart from lastSyncedAt so mail sent before Sent was read still gets picked up once. */
  lastSentSyncedAt: timestamp("last_sent_synced_at", { withTimezone: true }),
  lastError: text("last_error").notNull().default(""),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id),
    direction: direction("direction").notNull(),
    kind: messageKind("kind").notNull(),
    gmailId: text("gmail_id"),
    threadId: text("thread_id"),
    headerMessageId: text("header_message_id").notNull().default(""),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    sentBy: text("sent_by").notNull().default(""),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("messages_gmail_id").on(table.gmailId), index("messages_business").on(table.businessId)],
);

/** Opted-out email domains. Nobody at one of these is emailed again. */
export const doNotContact = pgTable("do_not_contact", {
  domain: text("domain").primaryKey(),
  reason: text("reason").notNull().default(""),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every action a founder, a script, or the sync takes. */
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    businessId: uuid("business_id").references(() => businesses.id),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    /** Review-queue priority, when the entry needs a founder's eyes: "fyi", "review", or "urgent". */
    priority: text("priority").notNull().default(""),
  },
  (table) => [index("activity_business").on(table.businessId), index("activity_at").on(table.at)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").notNull().default(""),
});

/**
 * A client's live site, built on site-kit in its own repo (site-<slug>). Its
 * content lives with the site; this row records who may ask for sign-in links.
 */
export const clientSites = pgTable(
  "client_sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    ownerEmail: text("owner_email").notNull(),
    url: text("url").notNull(),
    businessId: uuid("business_id").references(() => businesses.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [uniqueIndex("client_sites_slug").on(table.slug), index("client_sites_owner_email").on(table.ownerEmail)],
);

/**
 * Emailed editor links. Each works once: opening it on defect.tech and pressing
 * the button marks it used and hands the owner a short-lived site-kit token.
 * Only a hash of the code is stored.
 */
export const editorLinks = pgTable("editor_links", {
  codeHash: text("code_hash").primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => clientSites.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const botName = pgEnum("bot_name", BOTS);
export const flagStatus = pgEnum("flag_status", FLAG_STATUSES);
export const previewJobStatus = pgEnum("preview_job_status", PREVIEW_JOB_STATUSES);

/** API keys for the Grok Bots. Only a SHA-256 hash of each key is stored; the key is shown once. */
export const botKeys = pgTable(
  "bot_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bot: botName("bot").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    stages: stage("stages").array().notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    lastRoutine: text("last_routine").notNull().default(""),
  },
  (table) => [uniqueIndex("bot_keys_key_hash").on(table.keyHash)],
);

/** Every bot API call, kept apart from the activity log so reads don't crowd a lead's history. */
export const botCalls = pgTable(
  "bot_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    keyId: uuid("key_id").references(() => botKeys.id),
    bot: botName("bot"),
    method: text("method").notNull(),
    path: text("path").notNull(),
    status: integer("status").notNull(),
  },
  (table) => [index("bot_calls_at").on(table.at)],
);

/** The review queue: things a bot or the Overseer wants a founder to look at. */
export const flags = pgTable(
  "flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    bot: botName("bot").notNull(),
    businessId: uuid("business_id").references(() => businesses.id),
    priority: text("priority").notNull(),
    /** One plain sentence a founder reads at a glance. Empty on flags from before the review queue was rebuilt. */
    headline: text("headline").notNull().default(""),
    needs: text("needs").$type<FlagNeeds>().notNull().default("decision"),
    /** The question for a decision, or the step to take for a fix. */
    ask: text("ask").notNull().default(""),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    fixer: text("fixer").$type<Fixer>().notNull().default("either"),
    topic: text("topic").$type<FlagTopic>().notNull().default("other"),
    /** Every report merged into this flag, newest last. */
    details: text("details").notNull().default(""),
    reports: integer("reports").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    whatHappened: text("what_happened").notNull().default(""),
    whatBotDid: text("what_bot_did").notNull().default(""),
    why: text("why").notNull().default(""),
    link: text("link").notNull().default(""),
    status: flagStatus("status").notNull().default("open"),
    reviewer: text("reviewer").notNull().default(""),
    note: text("note").notNull().default(""),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("flags_status").on(table.status), index("flags_at").on(table.at), index("flags_lead_topic").on(table.businessId, table.topic)],
);

/**
 * The preview build queue. A founder or the Outreach bot queues a lead; the
 * preview runner claims one job at a time, builds it and reports back.
 */
export const previewJobs = pgTable(
  "preview_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    status: previewJobStatus("status").notNull().default("queued"),
    note: text("note").notNull().default(""),
    requestedBy: text("requested_by").notNull(),
    step: text("step").notNull().default(""),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    runnerName: text("runner_name").notNull().default(""),
    previewUrl: text("preview_url").notNull().default(""),
    verifyPassed: boolean("verify_passed"),
    worstCls: real("worst_cls"),
    criticVerdict: text("critic_verdict").notNull().default(""),
    tokens: integer("tokens"),
    minutes: real("minutes"),
    apiEquivalentUsd: real("api_equivalent_usd"),
    logTail: text("log_tail").notNull().default(""),
    attempts: integer("attempts").notNull().default(0),
    /** preview builds and redeploys a preview; launch puts a paid site live on its own Vercel project. */
    kind: text("kind").notNull().default("preview"),
    /** A launch's outcome: { projectId, liveUrl, records: [{ host, type, name, value }] }. */
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("preview_jobs_status").on(table.status, table.createdAt),
    uniqueIndex("preview_jobs_one_active")
      .on(table.businessId)
      .where(sql`${table.status} in (${sql.raw(ACTIVE_JOB_STATUSES.map((status) => `'${status}'`).join(", "))})`),
  ],
);

export const expenseFrequency = pgEnum("expense_frequency", ["monthly", "annual"]);

/** A cost that repeats. Each time it comes due it adds a row to expenses, which can then be edited on its own. */
export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  item: text("item").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paidBy: text("paid_by").notNull(),
  frequency: expenseFrequency("frequency").notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  /** The last date rows were added through, so a deleted month isn't added back. */
  addedThrough: date("added_through", { mode: "string" }),
  stoppedOn: date("stopped_on", { mode: "string" }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A business cost one founder paid. The founders split each month's total evenly. */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    item: text("item").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidBy: text("paid_by").notNull(),
    recurringId: uuid("recurring_id").references(() => recurringExpenses.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("expenses_spent_on").on(table.spentOn), uniqueIndex("expenses_recurring_date").on(table.recurringId, table.spentOn)],
);

/** One Zelle from a founder to the other, evening out a month's expenses. */
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    month: text("month").notNull(),
    fromFounder: text("from_founder").notNull(),
    toFounder: text("to_founder").notNull(),
    amountCents: integer("amount_cents").notNull(),
    recordedBy: text("recorded_by").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("settlements_month").on(table.month)],
);

/**
 * A finished preview picked at random for a founder to rate. The share picked is a
 * setting on the Spot checks page; the notes are read back by the preview runner.
 */
export const spotChecks = pgTable(
  "spot_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    jobId: uuid("job_id").references(() => previewJobs.id),
    previewUrl: text("preview_url").notNull(),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").$type<SpotCheckStatus>().notNull().default("open"),
    /** 1 to 5 each. Empty until a founder rates the preview. */
    copyRating: integer("copy_rating"),
    typographyRating: integer("typography_rating"),
    layoutRating: integer("layout_rating"),
    note: text("note").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("spot_checks_preview_url").on(table.previewUrl), index("spot_checks_status").on(table.status, table.sampledAt)],
);

/**
 * Every business the lead finder audited, whether or not it became a lead, so a
 * new niche or area can start from what's already been collected. Only the
 * Google place ID comes from Google; everything else is from the business's own
 * website (02-system/lead-finder.md).
 */
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "place:<place ID>", or "site:<domain>" for a website audited without Google. */
    key: text("key").notNull(),
    placeId: text("place_id"),
    businessName: text("business_name").notNull().default(""),
    website: text("website").notNull().default(""),
    domain: text("domain").notNull().default(""),
    niche: text("niche").notNull().default(""),
    area: text("area").notNull().default(""),
    platform: text("platform").notNull().default(""),
    email: text("email").notNull().default(""),
    emails: jsonb("emails").$type<string[]>().notNull().default([]),
    instagram: text("instagram").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    reviewLinks: jsonb("review_links").$type<string[]>().notNull().default([]),
    bookingLinks: jsonb("booking_links").$type<string[]>().notNull().default([]),
    orderingLinks: jsonb("ordering_links").$type<string[]>().notNull().default([]),
    pageTitle: text("page_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    copyrightYear: integer("copyright_year"),
    reachable: boolean("reachable").notNull().default(false),
    /** 0 to 100, lower is worse. Empty when the business has no website or it couldn't be read. */
    siteScore: integer("site_score"),
    outdatedScore: integer("outdated_score").notNull().default(0),
    signals: text("signals").array().notNull().default(sql`'{}'::text[]`),
    problemSummary: text("problem_summary").notNull().default(""),
    leadType: text("lead_type").notNull().default(""),
    pageCount: integer("page_count"),
    serverMs: integer("server_ms"),
    loadMs: integer("load_ms"),
    pageBytes: integer("page_bytes"),
    /** Everything the audit returned, including each signal's details. */
    audit: jsonb("audit").$type<Record<string, unknown>>().notNull().default({}),
    businessId: uuid("business_id").references(() => businesses.id),
    foundAt: timestamp("found_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("prospects_key").on(table.key),
    index("prospects_place_id").on(table.placeId),
    index("prospects_domain").on(table.domain),
    index("prospects_found_at").on(table.foundAt),
    index("prospects_site_score").on(table.siteScore),
    index("prospects_niche_area").on(table.niche, table.area),
    index("prospects_signals").using("gin", table.signals),
  ],
);

export type LeadSource = "lead_finder" | "request";

/**
 * People asking us for a website through the form on defect.tech, and emails to hello@defect.tech from
 * addresses that match no lead. The Client care bot sorts the emails; a founder approves every request.
 */
export const inboundRequests = pgTable(
  "inbound_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").$type<InboundSource>().notNull(),
    kind: text("kind").$type<InboundKind>().notNull().default("unsorted"),
    status: text("status").$type<InboundStatus>().notNull().default("open"),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    businessName: text("business_name").notNull().default(""),
    website: text("website").notNull().default(""),
    /** What they told us about the business: the form's text box, or the bot's summary of an email. */
    about: text("about").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    gmailId: text("gmail_id"),
    threadId: text("thread_id"),
    headerMessageId: text("header_message_id").notNull().default(""),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id),
    /** The bot's one-line reason for how it sorted the email. */
    reason: text("reason").notNull().default(""),
    sortedBy: text("sorted_by").notNull().default(""),
    sortedAt: timestamp("sorted_at", { withTimezone: true }),
    flagId: uuid("flag_id").references(() => flags.id),
    businessId: uuid("business_id").references(() => businesses.id),
    decidedBy: text("decided_by").notNull().default(""),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    replyBody: text("reply_body").notNull().default(""),
    repliedBy: text("replied_by").notNull().default(""),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    /** A keyed hash of the form sender's IP address, kept only to limit how often one address can send the form. */
    ipHash: text("ip_hash").notNull().default(""),
  },
  (table) => [
    uniqueIndex("inbound_requests_gmail_id").on(table.gmailId),
    index("inbound_requests_status").on(table.status, table.kind),
    index("inbound_requests_ip").on(table.ipHash, table.at),
  ],
);

export type Business = typeof businesses.$inferSelect;
export type InboundRequest = typeof inboundRequests.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Mailbox = typeof mailboxes.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type ClientSite = typeof clientSites.$inferSelect;
export type BotKey = typeof botKeys.$inferSelect;
export type Flag = typeof flags.$inferSelect;
export type PreviewJob = typeof previewJobs.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type SpotCheck = typeof spotChecks.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type ExpenseFrequency = RecurringExpense["frequency"];
