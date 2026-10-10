CREATE TYPE "public"."expense_frequency" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_by" text NOT NULL,
	"frequency" "expense_frequency" NOT NULL,
	"starts_on" date NOT NULL,
	"added_through" date,
	"stopped_on" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_recurring_date" ON "expenses" USING btree ("recurring_id","spent_on");