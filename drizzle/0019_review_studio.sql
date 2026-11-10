CREATE TABLE "preview_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"preview_url" text NOT NULL,
	"verdict" text NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"job_id" uuid,
	"reviewed_by" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_business_id" uuid,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "preview_reviews" ADD CONSTRAINT "preview_reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_reviews" ADD CONSTRAINT "preview_reviews_job_id_preview_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_lessons" ADD CONSTRAINT "taste_lessons_source_business_id_businesses_id_fk" FOREIGN KEY ("source_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preview_reviews_business" ON "preview_reviews" USING btree ("business_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "preview_reviews_preview_url" ON "preview_reviews" USING btree ("preview_url");--> statement-breakpoint
CREATE INDEX "taste_lessons_active" ON "taste_lessons" USING btree ("retired_at","created_at");