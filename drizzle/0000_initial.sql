CREATE TYPE "public"."direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('first', 'follow_up', 'reply', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('new', 'preview_built', 'sent', 'clicked', 'replied', 'paid', 'live', 'lost', 'opted_out');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"business_id" uuid,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text,
	"slug" text NOT NULL,
	"link_code" text NOT NULL,
	"business_name" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"owner_first_name" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"platform" text DEFAULT '' NOT NULL,
	"copyright_year" integer,
	"outdated_score" integer DEFAULT 0 NOT NULL,
	"outdated_signals" text DEFAULT '' NOT NULL,
	"problem_summary" text DEFAULT '' NOT NULL,
	"lead_type" text DEFAULT '' NOT NULL,
	"niche" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"found_date" text DEFAULT '' NOT NULL,
	"stage" "stage" DEFAULT 'new' NOT NULL,
	"price_arm" integer,
	"note" text DEFAULT '' NOT NULL,
	"preview_url" text DEFAULT '' NOT NULL,
	"email_problem" text DEFAULT '' NOT NULL,
	"preview_built_at" timestamp with time zone,
	"first_sent_at" timestamp with time zone,
	"follow_up_sent_at" timestamp with time zone,
	"thread_id" text,
	"first_message_header_id" text,
	"mailbox_id" uuid,
	"clicked_at" timestamp with time zone,
	"click_count" integer DEFAULT 0 NOT NULL,
	"replied_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"plan" text DEFAULT '' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"owner_email" text DEFAULT '' NOT NULL,
	"site_url" text DEFAULT '' NOT NULL,
	"vercel_project_id" text DEFAULT '' NOT NULL,
	"launched_at" timestamp with time zone,
	"dns_backup" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "do_not_contact" (
	"domain" text PRIMARY KEY NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"sealed_refresh_token" text NOT NULL,
	"is_sender" boolean DEFAULT false NOT NULL,
	"connected_by" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text DEFAULT '' NOT NULL,
	CONSTRAINT "mailboxes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"direction" "direction" NOT NULL,
	"kind" "message_kind" NOT NULL,
	"gmail_id" text,
	"thread_id" text,
	"header_message_id" text DEFAULT '' NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"sent_by" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_business" ON "activity" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "activity_at" ON "activity" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_place_id" ON "businesses" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_link_code" ON "businesses" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "businesses_stage" ON "businesses" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_gmail_id" ON "messages" USING btree ("gmail_id");--> statement-breakpoint
CREATE INDEX "messages_business" ON "messages" USING btree ("business_id");