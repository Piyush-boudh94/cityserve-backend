import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { complaintsTable } from "./complaints";
import { usersTable } from "./users";

export const savesTable = pgTable("saves", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id")
    .notNull()
    .references(() => complaintsTable.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.complaintId, t.userId)]);

export type Save = typeof savesTable.$inferSelect;
