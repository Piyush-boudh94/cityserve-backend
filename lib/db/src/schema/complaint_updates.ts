import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { complaintsTable } from "./complaints";
import { usersTable } from "./users";

export const complaintUpdatesTable = pgTable("complaint_updates", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id")
    .notNull()
    .references(() => complaintsTable.id),
  status: text("status").notNull(),
  note: text("note"),
  progressPercent: integer("progress_percent"),
  imageUrl: text("image_url"),
  updatedById: integer("updated_by_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertComplaintUpdateSchema = createInsertSchema(
  complaintUpdatesTable,
).omit({ id: true, createdAt: true });

export type InsertComplaintUpdate = z.infer<typeof insertComplaintUpdateSchema>;
export type ComplaintUpdate = typeof complaintUpdatesTable.$inferSelect;
