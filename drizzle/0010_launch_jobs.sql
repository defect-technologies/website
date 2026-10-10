ALTER TABLE "preview_jobs" ADD COLUMN "kind" text DEFAULT 'preview' NOT NULL;--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "result" jsonb;