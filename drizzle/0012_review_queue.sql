ALTER TYPE "public"."flag_status" ADD VALUE 'fixed';--> statement-breakpoint
ALTER TYPE "public"."flag_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TABLE "flags" ALTER COLUMN "what_happened" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "flags" ALTER COLUMN "what_bot_did" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "flags" ALTER COLUMN "why" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "headline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "needs" text DEFAULT 'decision' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "ask" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "fixer" text DEFAULT 'either' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "topic" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "details" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "reports" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "flags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "flags_lead_topic" ON "flags" USING btree ("business_id","topic");--> statement-breakpoint
UPDATE "flags" SET "details" = concat_ws(E'\n\n', "what_happened", nullif('What the bot did: ' || "what_bot_did", 'What the bot did: '), nullif('Why: ' || "why", 'Why: ')), "updated_at" = "at";
