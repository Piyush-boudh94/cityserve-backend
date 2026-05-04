import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const otpSessionsTable = pgTable("otp_sessions", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  otp: text("otp").notNull(),
  sessionId: text("session_id").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpSession = typeof otpSessionsTable.$inferSelect;
