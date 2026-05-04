import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const wardsTable = pgTable("wards", {
  id: serial("id").primaryKey(),
  wardId: text("ward_id").notNull().unique(),
  name: text("name").notNull(),
  wardNumber: integer("ward_number").notNull(),
  cityName: text("city_name").notNull().default("CityServe"),
});

export const insertWardSchema = createInsertSchema(wardsTable).omit({ id: true });
export type InsertWard = z.infer<typeof insertWardSchema>;
export type Ward = typeof wardsTable.$inferSelect;
