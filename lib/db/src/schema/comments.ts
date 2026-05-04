import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { complaintsTable } from "./complaints";
import { usersTable } from "./users";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id")
    .notNull()
    .references(() => complaintsTable.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Comment = typeof commentsTable.$inferSelect;
