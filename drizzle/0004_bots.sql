CREATE TYPE "public"."bot_name" AS ENUM('outreach', 'onboarding', 'client_care', 'overseer');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'answered', 'approved', 'reversed');--> statement-breakpoint
CREATE TABLE "bot_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_id" uuid,
	"bot" "bot_name",
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot" "bot_name" NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"stages" "stage"[] NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"last_routine" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"bot" "bot_name" NOT NULL,
	"business_id" uuid,
	"priority" text NOT NULL,
	"what_happened" text NOT NULL,
	"what_bot_did" text NOT NULL,
	"why" text NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"reviewer" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bot_calls" ADD CONSTRAINT "bot_calls_key_id_bot_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."bot_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_calls_at" ON "bot_calls" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_keys_key_hash" ON "bot_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "flags_status" ON "flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flags_at" ON "flags" USING btree ("at");