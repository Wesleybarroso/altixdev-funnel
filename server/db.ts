import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertEventLog, InsertIntegrationConfig, InsertLead, InsertUser, InsertWebhook, eventLogs, integrationConfigs, leads, users, webhooks } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db.insert(leads).values(lead);
  return Number(result[0].insertId);
}

export async function listLeads(filters?: { search?: string; stage?: (typeof leads.stage.enumValues)[number] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const conditions = [];
  if (filters?.stage) conditions.push(eq(leads.stage, filters.stage));
  if (filters?.search?.trim()) {
    const query = `%${filters.search.trim()}%`;
    conditions.push(or(like(leads.name, query), like(leads.email, query), like(leads.company, query))!);
  }

  return db
    .select()
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt));
}

export async function updateLead(
  id: number,
  changes: Partial<Pick<InsertLead, "stage" | "priority" | "notes" | "nextStep">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  await db.update(leads).set(changes).where(eq(leads.id, id));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const records = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return records[0];
}

export async function listWebhooks() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
}

export async function getWebhookById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const records = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return records[0];
}

export async function createWebhook(webhook: InsertWebhook) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(webhooks).values(webhook);
  return Number(result[0].insertId);
}

export async function updateWebhook(id: number, changes: Partial<Pick<InsertWebhook, "name" | "urlCiphertext" | "authHeaderName" | "secretCiphertext" | "enabled">>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(webhooks).set(changes).where(eq(webhooks.id, id));
}

export async function deleteWebhook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.delete(webhooks).where(eq(webhooks.id, id));
}

export async function recordWebhookTest(id: number, status: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(webhooks).set({ lastTestAt: new Date(), lastStatus: status }).where(eq(webhooks.id, id));
}

export async function createEventLog(event: InsertEventLog) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(eventLogs).values(event);
  return Number(result[0].insertId);
}

export async function listEventLogs(filters?: { category?: string; status?: (typeof eventLogs.status.enumValues)[number]; limit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const conditions = [];
  if (filters?.category) conditions.push(eq(eventLogs.category, filters.category));
  if (filters?.status) conditions.push(eq(eventLogs.status, filters.status));
  return db.select().from(eventLogs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(eventLogs.createdAt)).limit(filters?.limit ?? 250);
}

export async function getIntegrationConfigByProvider(provider: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const records = await db.select().from(integrationConfigs).where(eq(integrationConfigs.provider, provider)).limit(1);
  return records[0];
}

export async function upsertIntegrationConfig(config: InsertIntegrationConfig) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(integrationConfigs).values(config).onDuplicateKeyUpdate({
    set: { configCiphertext: config.configCiphertext, enabled: config.enabled, lastMessage: "Configuração atualizada." },
  });
}

export async function recordIntegrationCheck(provider: string, status: number | null, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(integrationConfigs).set({ lastCheckAt: new Date(), lastStatus: status, lastMessage: message }).where(eq(integrationConfigs.provider, provider));
}
