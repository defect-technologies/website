CREATE TABLE "client_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_email" text NOT NULL,
	"url" text NOT NULL,
	"business_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
DROP TABLE "sign_in_links" CASCADE;--> statement-breakpoint
DROP TABLE "site_versions" CASCADE;--> statement-breakpoint
DROP TABLE "sites" CASCADE;--> statement-breakpoint
ALTER TABLE "client_sites" ADD CONSTRAINT "client_sites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_sites_slug" ON "client_sites" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "client_sites_owner_email" ON "client_sites" USING btree ("owner_email");