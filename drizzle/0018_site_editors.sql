CREATE TABLE "client_site_editors" (
	"site_id" uuid NOT NULL,
	"email" text NOT NULL,
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_site_editors" ADD CONSTRAINT "client_site_editors_site_id_client_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."client_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_site_editors_site_email" ON "client_site_editors" USING btree ("site_id","email");--> statement-breakpoint
CREATE INDEX "client_site_editors_email" ON "client_site_editors" USING btree ("email");