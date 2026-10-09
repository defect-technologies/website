CREATE TABLE "sign_in_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"saved_by" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"business_id" uuid,
	"owner_email" text NOT NULL,
	"content" jsonb NOT NULL,
	"asset_base_url" text DEFAULT '' NOT NULL,
	"live_url" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "priority" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sign_in_links_email" ON "sign_in_links" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "site_versions_site_version" ON "site_versions" USING btree ("site_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_slug" ON "sites" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sites_owner_email" ON "sites" USING btree ("owner_email");
