CREATE TABLE "editor_links" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editor_links" ADD CONSTRAINT "editor_links_site_id_client_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."client_sites"("id") ON DELETE cascade ON UPDATE no action;