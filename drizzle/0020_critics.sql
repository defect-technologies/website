CREATE TABLE "critic_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"proposal_id" text NOT NULL,
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"accepted" boolean NOT NULL,
	"answered_by" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "critic_notes" jsonb;--> statement-breakpoint
ALTER TABLE "critic_answers" ADD CONSTRAINT "critic_answers_job_id_preview_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."preview_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critic_answers" ADD CONSTRAINT "critic_answers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "critic_answers_one_per_proposal" ON "critic_answers" USING btree ("job_id","proposal_id");--> statement-breakpoint
CREATE INDEX "critic_answers_kind" ON "critic_answers" USING btree ("kind");