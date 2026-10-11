ALTER TYPE "public"."message_kind" ADD VALUE 'requested';--> statement-breakpoint
CREATE TABLE "inbound_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"kind" text DEFAULT 'unsorted' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"business_name" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"gmail_id" text,
	"thread_id" text,
	"header_message_id" text DEFAULT '' NOT NULL,
	"mailbox_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"sorted_by" text DEFAULT '' NOT NULL,
	"sorted_at" timestamp with time zone,
	"flag_id" uuid,
	"business_id" uuid,
	"decided_by" text DEFAULT '' NOT NULL,
	"decided_at" timestamp with time zone,
	"reply_body" text DEFAULT '' NOT NULL,
	"replied_by" text DEFAULT '' NOT NULL,
	"replied_at" timestamp with time zone,
	"ip_hash" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "source" text DEFAULT 'lead_finder' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "brief" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_requests_gmail_id" ON "inbound_requests" USING btree ("gmail_id");--> statement-breakpoint
CREATE INDEX "inbound_requests_status" ON "inbound_requests" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "inbound_requests_ip" ON "inbound_requests" USING btree ("ip_hash","at");