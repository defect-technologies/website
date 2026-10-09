CREATE TYPE "public"."preview_job_status" AS ENUM('queued', 'claimed', 'running', 'done', 'failed', 'waiting_for_usage');--> statement-breakpoint
ALTER TYPE "public"."bot_name" ADD VALUE 'runner';--> statement-breakpoint
CREATE TABLE "preview_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"status" "preview_job_status" DEFAULT 'queued' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"requested_by" text NOT NULL,
	"step" text DEFAULT '' NOT NULL,
	"claimed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"runner_name" text DEFAULT '' NOT NULL,
	"preview_url" text DEFAULT '' NOT NULL,
	"verify_passed" boolean,
	"worst_cls" real,
	"critic_verdict" text DEFAULT '' NOT NULL,
	"tokens" integer,
	"minutes" real,
	"api_equivalent_usd" real,
	"log_tail" text DEFAULT '' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "preview_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "preview_requested_by" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD CONSTRAINT "preview_jobs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preview_jobs_status" ON "preview_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preview_jobs_one_active" ON "preview_jobs" USING btree ("business_id") WHERE "preview_jobs"."status" in ('queued', 'claimed', 'running');