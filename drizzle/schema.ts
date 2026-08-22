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

/**
 * Destinos externos configurados pelo administrador. Os dados sensíveis são
 * persistidos cifrados; a interface recebe apenas uma representação segura.
 */
export const webhooks = mysqlTable("webhooks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  urlCiphertext: text("urlCiphertext").notNull(),
  authHeaderName: varchar("authHeaderName", { length: 100 }),
  secretCiphertext: text("secretCiphertext"),
  enabled: boolean("enabled").notNull().default(true),
  lastTestAt: timestamp("lastTestAt"),
  lastStatus: int("lastStatus"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

/** Histórico auditável das ações comerciais e integrações do painel. */
export const eventLogs = mysqlTable("eventLogs", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 48 }).notNull(),
  eventType: varchar("eventType", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["info", "success", "warning", "error"]).notNull().default("info"),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EventLog = typeof eventLogs.$inferSelect;
export type InsertEventLog = typeof eventLogs.$inferInsert;

/** Configurações de integrações externas, cifradas em repouso no banco. */
export const integrationConfigs = mysqlTable("integrationConfigs", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 48 }).notNull().unique(),
  configCiphertext: text("configCiphertext").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  lastCheckAt: timestamp("lastCheckAt"),
  lastStatus: int("lastStatus"),
  lastMessage: varchar("lastMessage", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type InsertIntegrationConfig = typeof integrationConfigs.$inferInsert;
