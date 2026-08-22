import { google } from "googleapis";
import { Client } from "pg";
import type { Lead } from "../drizzle/schema";
import { decryptWebhookValue, validateWebhookUrl } from "./webhookService";

export type GoogleSheetsConfig = { serviceAccountJson: string; spreadsheetId: string; sheetName: string; autoSync?: boolean };
export type PostgresConfig = { connectionString: string; tableName: string; ssl: boolean; autoSync?: boolean };

const headers = ["source_lead_id", "name", "email", "phone", "company", "stage", "priority", "source", "objective", "current_channel", "bottleneck", "urgency", "diagnostic_summary", "notes", "next_step", "consent", "created_at", "updated_at"];

function parseGoogleConfig(ciphertext: string): GoogleSheetsConfig {
  const config = JSON.parse(decryptWebhookValue(ciphertext)) as GoogleSheetsConfig;
  validateGoogleConfig(config);
  return config;
}

function parsePostgresConfig(ciphertext: string): PostgresConfig {
  const config = JSON.parse(decryptWebhookValue(ciphertext)) as PostgresConfig;
  validatePostgresConfig(config);
  return config;
}

function rowFromLead(lead: Lead) {
  return [lead.id, lead.name, lead.email, lead.phone, lead.company ?? "", lead.stage, lead.priority, lead.source, lead.objective, lead.currentChannel, lead.bottleneck, lead.urgency, lead.diagnosticSummary, lead.notes ?? "", lead.nextStep ?? "", lead.consent ? "true" : "false", lead.createdAt.toISOString(), lead.updatedAt.toISOString()];
}

export function findGoogleSheetLeadRow(values: unknown[][] | null | undefined, leadId: number) {
  const index = values?.findIndex(row => String(row?.[0] ?? "").trim() === String(leadId)) ?? -1;
  return index >= 0 ? index + 2 : null;
}

function safeSheetName(name: string) {
  if (!/^[A-Za-z0-9_ -]{1,100}$/.test(name)) throw new Error("Nome da aba inválido.");
  return name;
}

function safeTableName(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)) throw new Error("Nome da tabela PostgreSQL inválido.");
  return name;
}

export function validateGoogleConfig(config: GoogleSheetsConfig) {
  if (!config.spreadsheetId.trim()) throw new Error("Informe o ID da planilha Google.");
  safeSheetName(config.sheetName);
  try {
    const credentials = JSON.parse(config.serviceAccountJson) as { client_email?: string; private_key?: string };
    if (!credentials.client_email || !credentials.private_key) throw new Error();
  } catch {
    throw new Error("A credencial Google deve ser um JSON válido de conta de serviço.");
  }
  return { serviceAccountJson: config.serviceAccountJson.trim(), spreadsheetId: config.spreadsheetId.trim(), sheetName: config.sheetName.trim(), autoSync: Boolean(config.autoSync) };
}

export function validatePostgresConfig(config: PostgresConfig) {
  const connection = new URL(config.connectionString);
  if (!["postgres:", "postgresql:"].includes(connection.protocol)) throw new Error("A conexão PostgreSQL deve iniciar com postgres:// ou postgresql://.");
  return { connectionString: config.connectionString.trim(), tableName: safeTableName(config.tableName || "altixdev_leads"), ssl: Boolean(config.ssl), autoSync: Boolean(config.autoSync) };
}

async function getSheetsClient(config: GoogleSheetsConfig) {
  const credentials = JSON.parse(config.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

export async function testGoogleSheets(ciphertext: string) {
  const config = parseGoogleConfig(ciphertext);
  const sheets = await getSheetsClient(config);
  const response = await sheets.spreadsheets.get({ spreadsheetId: config.spreadsheetId, fields: "spreadsheetId,properties.title" });
  return { ok: Boolean(response.data.spreadsheetId), title: response.data.properties?.title ?? "Planilha conectada" };
}

export async function syncLeadToGoogleSheets(ciphertext: string, lead: Lead) {
  const config = parseGoogleConfig(ciphertext);
  const sheets = await getSheetsClient(config);
  const safeName = safeSheetName(config.sheetName).replaceAll("'", "''");
  const range = `'${safeName}'!A:R`;
  const firstRow = await sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheetId, range: `'${safeName}'!1:1` });
  if (!firstRow.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.append({ spreadsheetId: config.spreadsheetId, range, valueInputOption: "RAW", requestBody: { values: [headers] } });
  }
  const idColumn = await sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheetId, range: `'${safeName}'!A2:A` });
  const existingRow = findGoogleSheetLeadRow(idColumn.data.values, lead.id);
  if (existingRow) {
    await sheets.spreadsheets.values.update({ spreadsheetId: config.spreadsheetId, range: `'${safeName}'!A${existingRow}:R${existingRow}`, valueInputOption: "RAW", requestBody: { values: [rowFromLead(lead)] } });
    return { ok: true, updated: true };
  }
  await sheets.spreadsheets.values.append({ spreadsheetId: config.spreadsheetId, range, valueInputOption: "RAW", requestBody: { values: [rowFromLead(lead)] } });
  return { ok: true, updated: false };
}

function postgresClient(config: PostgresConfig) {
  return new Client({ connectionString: config.connectionString, ssl: config.ssl ? { rejectUnauthorized: false } : false, connectionTimeoutMillis: 10000 });
}

export async function testPostgres(ciphertext: string) {
  const config = parsePostgresConfig(ciphertext);
  const client = postgresClient(config);
  try {
    await client.connect();
    const response = await client.query("SELECT 1 AS connected");
    return { ok: response.rows[0]?.connected === 1 };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function syncLeadToPostgres(ciphertext: string, lead: Lead) {
  const config = parsePostgresConfig(ciphertext);
  const table = safeTableName(config.tableName);
  const client = postgresClient(config);
  try {
    await client.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS "${table}" (
      source_lead_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, company TEXT,
      stage TEXT NOT NULL, priority TEXT NOT NULL, source TEXT NOT NULL,
      objective TEXT NOT NULL, current_channel TEXT NOT NULL, bottleneck TEXT NOT NULL, urgency TEXT NOT NULL,
      diagnostic_summary TEXT NOT NULL, notes TEXT, next_step TEXT, consent BOOLEAN NOT NULL,
      source_created_at TIMESTAMPTZ NOT NULL, source_updated_at TIMESTAMPTZ NOT NULL, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(
      `INSERT INTO "${table}" (source_lead_id, name, email, phone, company, stage, priority, source, objective, current_channel, bottleneck, urgency, diagnostic_summary, notes, next_step, consent, source_created_at, source_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (source_lead_id) DO UPDATE SET
       name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, company=EXCLUDED.company, stage=EXCLUDED.stage, priority=EXCLUDED.priority, source=EXCLUDED.source, objective=EXCLUDED.objective, current_channel=EXCLUDED.current_channel, bottleneck=EXCLUDED.bottleneck, urgency=EXCLUDED.urgency, diagnostic_summary=EXCLUDED.diagnostic_summary, notes=EXCLUDED.notes, next_step=EXCLUDED.next_step, consent=EXCLUDED.consent, source_created_at=EXCLUDED.source_created_at, source_updated_at=EXCLUDED.source_updated_at, synced_at=NOW()`,
      [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.stage, lead.priority, lead.source, lead.objective, lead.currentChannel, lead.bottleneck, lead.urgency, lead.diagnosticSummary, lead.notes, lead.nextStep, lead.consent, lead.createdAt, lead.updatedAt],
    );
    return { ok: true };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function normalizeNtfyServerUrl(serverUrl: string) {
  return validateWebhookUrl(serverUrl);
}
