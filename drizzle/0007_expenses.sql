CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"item" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_by" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"from_founder" text NOT NULL,
	"to_founder" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"recorded_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expenses_spent_on" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "settlements_month" ON "settlements" USING btree ("month");