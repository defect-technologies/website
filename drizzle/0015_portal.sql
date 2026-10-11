CREATE TABLE "portal_accounts" (
	"email" text PRIMARY KEY NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"password_set_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_failed_sign_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_links" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"next" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "portal_failed_sign_ins_email" ON "portal_failed_sign_ins" USING btree ("email","at");--> statement-breakpoint
CREATE INDEX "portal_links_email" ON "portal_links" USING btree ("email","created_at");