CREATE TABLE "designer_claims" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"designer_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designer_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"added_by" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preview_jobs" ADD COLUMN "repair" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "designer_claims" ADD CONSTRAINT "designer_claims_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designer_claims" ADD CONSTRAINT "designer_claims_designer_id_designers_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."designers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designer_payments" ADD CONSTRAINT "designer_payments_designer_id_designers_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."designers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "designer_claims_designer" ON "designer_claims" USING btree ("designer_id","claimed_at");--> statement-breakpoint
CREATE INDEX "designer_payments_designer" ON "designer_payments" USING btree ("designer_id","paid_on");--> statement-breakpoint
CREATE UNIQUE INDEX "designers_email" ON "designers" USING btree ("email");