CREATE TABLE "carriers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"document_type" text NOT NULL,
	"carrier_id" integer,
	"s3_key" text NOT NULL,
	"s3_url" text,
	"file_size" integer NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"textract_job_id" text,
	"csv_s3_key" text,
	"csv_url" text,
	"json_s3_key" text,
	"json_url" text,
	"processing_error" text,
	"metadata" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;