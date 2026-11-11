CREATE TABLE "design_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"options" jsonb NOT NULL,
	"pick" jsonb,
	"chosen_letter" text,
	"feedback" text DEFAULT '' NOT NULL,
	"chosen_by" text,
	"chosen_at" timestamp with time zone,
	"built_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_boards" ADD CONSTRAINT "design_boards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_boards" ADD CONSTRAINT "design_boards_job_id_preview_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_boards" ADD CONSTRAINT "design_boards_built_job_id_preview_jobs_id_fk" FOREIGN KEY ("built_job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_boards_business" ON "design_boards" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "design_boards_waiting" ON "design_boards" USING btree ("chosen_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "design_boards_job" ON "design_boards" USING btree ("job_id");