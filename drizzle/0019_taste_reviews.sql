CREATE TABLE "taste_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"category" text NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"job_id" uuid,
	"preview_url" text NOT NULL,
	"verdict" text NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"rebuild_job_id" uuid,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taste_notes" ADD CONSTRAINT "taste_notes_review_id_taste_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."taste_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_notes" ADD CONSTRAINT "taste_notes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_reviews" ADD CONSTRAINT "taste_reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_reviews" ADD CONSTRAINT "taste_reviews_job_id_preview_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_reviews" ADD CONSTRAINT "taste_reviews_rebuild_job_id_preview_jobs_id_fk" FOREIGN KEY ("rebuild_job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "taste_notes_scope_status" ON "taste_notes" USING btree ("scope","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "taste_reviews_preview_url" ON "taste_reviews" USING btree ("preview_url");--> statement-breakpoint
CREATE INDEX "taste_reviews_reviewed_at" ON "taste_reviews" USING btree ("reviewed_at");