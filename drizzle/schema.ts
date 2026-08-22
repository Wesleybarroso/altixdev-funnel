import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const leadStages = ["new", "diagnostic", "proposal", "won", "lost"] as const;
export const leadPriorities = ["low", "medium", "high"] as const;

/**
 * Contacts collected through the public conversion flow. Diagnostic answers are
 * retained with the lead so the sales conversation starts with full context.
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 48 }).notNull(),
  company: varchar("company", { length: 160 }),
  source: varchar("source", { length: 64 }).notNull().default("website"),
  objective: varchar("objective", { length: 120 }).notNull(),
  currentChannel: varchar("currentChannel", { length: 120 }).notNull(),
  bottleneck: varchar("bottleneck", { length: 160 }).notNull(),
  urgency: varchar("urgency", { length: 64 }).notNull(),
  diagnosticSummary: text("diagnosticSummary").notNull(),
  consent: boolean("consent").notNull().default(false),
  consentAt: timestamp("consentAt"),
  whatsappRedirectedAt: timestamp("whatsappRedirectedAt"),
  stage: mysqlEnum("stage", leadStages).notNull().default("new"),
  priority: mysqlEnum("priority", leadPriorities).notNull().default("medium"),
  notes: text("notes"),
  nextStep: text("nextStep"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
