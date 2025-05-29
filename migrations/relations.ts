import { relations } from "drizzle-orm/relations";
import { carriers, documents } from "./schema";

export const documentsRelations = relations(documents, ({one}) => ({
	carrier: one(carriers, {
		fields: [documents.carrierId],
		references: [carriers.id]
	}),
}));

export const carriersRelations = relations(carriers, ({many}) => ({
	documents: many(documents),
}));