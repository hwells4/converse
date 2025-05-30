import { pgTable, foreignKey, serial, text, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const documents = pgTable("documents", {
	id: serial().primaryKey().notNull(),
	filename: text().notNull(),
	originalName: text("original_name").notNull(),
	documentType: text("document_type").notNull(),
	carrierId: integer("carrier_id"),
	s3Key: text("s3_key").notNull(),
	s3Url: text("s3_url"),
	fileSize: integer("file_size").notNull(),
	status: text().default('uploaded').notNull(),
	textractJobId: text("textract_job_id"),
	csvS3Key: text("csv_s3_key"),
	csvUrl: text("csv_url"),
	jsonS3Key: text("json_s3_key"),
	jsonUrl: text("json_url"),
	processingError: text("processing_error"),
	metadata: jsonb(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.carrierId],
			foreignColumns: [carriers.id],
			name: "documents_carrier_id_carriers_id_fk"
		}),
]);

export const carriers = pgTable("carriers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	salesforceId: text("salesforce_id"),
}, (table) => [
	unique("carriers_salesforce_id_unique").on(table.salesforceId),
]);
