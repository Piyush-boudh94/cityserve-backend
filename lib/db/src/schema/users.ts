import { pgTable, serial, text, timestamp, pgEnum, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["citizen", "worker", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  firebaseUid: text("firebase_uid"),
  passwordHash: text("password_hash"),
  wardId: integer("ward_id"),
  avatarUrl: text("avatar_url"),
  role: roleEnum("role").notNull().default("citizen"),
  isActive: boolean("is_active").notNull().default(true),
  fcmToken: text("fcm_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
