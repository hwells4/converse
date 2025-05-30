ALTER TABLE "carriers" ADD COLUMN "salesforce_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_salesforce_id_unique" UNIQUE("salesforce_id");