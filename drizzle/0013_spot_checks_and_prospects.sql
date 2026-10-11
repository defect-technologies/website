CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"place_id" text,
	"business_name" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"niche" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"platform" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"review_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ordering_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_title" text DEFAULT '' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"copyright_year" integer,
	"reachable" boolean DEFAULT false NOT NULL,
	"site_score" integer,
	"outdated_score" integer DEFAULT 0 NOT NULL,
	"signals" text[] DEFAULT '{}'::text[] NOT NULL,
	"problem_summary" text DEFAULT '' NOT NULL,
	"lead_type" text DEFAULT '' NOT NULL,
	"page_count" integer,
	"server_ms" integer,
	"load_ms" integer,
	"page_bytes" integer,
	"audit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"business_id" uuid,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"job_id" uuid,
	"preview_url" text NOT NULL,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"copy_rating" integer,
	"typography_rating" integer,
	"layout_rating" integer,
	"note" text DEFAULT '' NOT NULL,
	"reviewed_by" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_checks" ADD CONSTRAINT "spot_checks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_checks" ADD CONSTRAINT "spot_checks_job_id_preview_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_key" ON "prospects" USING btree ("key");--> statement-breakpoint
CREATE INDEX "prospects_place_id" ON "prospects" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "prospects_domain" ON "prospects" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "prospects_found_at" ON "prospects" USING btree ("found_at");--> statement-breakpoint
CREATE INDEX "prospects_site_score" ON "prospects" USING btree ("site_score");--> statement-breakpoint
CREATE INDEX "prospects_niche_area" ON "prospects" USING btree ("niche","area");--> statement-breakpoint
CREATE INDEX "prospects_signals" ON "prospects" USING gin ("signals");--> statement-breakpoint
CREATE UNIQUE INDEX "spot_checks_preview_url" ON "spot_checks" USING btree ("preview_url");--> statement-breakpoint
CREATE INDEX "spot_checks_status" ON "spot_checks" USING btree ("status","sampled_at");