import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const statusEnum = pgEnum("complaint_status", [
  "pending",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

export const priorityEnum = pgEnum("complaint_priority", [
  "low",
  "medium",
  "high",
]);

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").notNull().default("pending"),
  priority: priorityEnum("priority").notNull().default("medium"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
  imageUrl: text("image_url"),
  wardId: integer("ward_id"),
  upvoteCount: integer("upvote_count").notNull().default(0),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categoriesTable.id),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Complaint = typeof complaintsTable.$inferSelect;
