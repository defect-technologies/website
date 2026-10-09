import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, index, uuid } from "drizzle-orm/pg-core";
import { STAGES, type Stage } from "../../lib/stages";

export { STAGES, type Stage };

export const stage = pgEnum("stage", STAGES);
export const direction = pgEnum("direction", ["out", "in"]);
export const messageKind = pgEnum("message_kind", ["first", "follow_up", "reply", "inbound"]);

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

export type Business = typeof businesses.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Mailbox = typeof mailboxes.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type ClientSite = typeof clientSites.$inferSelect;
