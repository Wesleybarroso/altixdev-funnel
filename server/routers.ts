import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, createAdminSession, getAdminSessionDuration, getConfiguredAdminEmail, verifyAdminCredentials } from "./adminAuth";
import { createEventLog, createLead, createWebhook, deleteWebhook, getIntegrationConfigByProvider, getLeadById, getWebhookById, listEventLogs, listLeads, listWebhooks, recordIntegrationCheck, recordWebhookTest, updateLead, updateWebhook, upsertIntegrationConfig } from "./db";
import { getAdminSessionCookieOptions, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { createLeadWebhookPayload, createWebhookTestPayload, decryptWebhookValue, encryptWebhookValue, postWebhook, validateWebhookUrl } from "./webhookService";
import { composeNtfyEvent, sendNtfyNotification, validateNtfyConfig } from "./ntfyService";
import { sendChanifyNotification, validateChanifyConfig } from "./chanifyService";
import { syncLeadToGoogleSheets, syncLeadToPostgres, testGoogleSheets, testPostgres, validateGoogleConfig, validatePostgresConfig } from "./directCrmService";
import { getGoogleAnalyticsOverview, testGoogleAnalytics, validateGoogleAnalyticsConfig } from "./googleAnalyticsService";

const leadStageSchema = z.enum(["new", "diagnostic", "proposal", "won", "lost"]);
const leadPrioritySchema = z.enum(["low", "medium", "high"]);
const webhookIdSchema = z.number().int().positive();
const webhookInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(2000),
  authHeaderName: z.string().trim().regex(/^[A-Za-z0-9-]{1,100}$/).nullable().optional(),
  secret: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().default(true),
});
const logStatusSchema = z.enum(["info", "success", "warning", "error"]);
const directProviderSchema = z.enum(["google_sheets", "postgres"]);

async function recordEvent(input: { category: string; eventType: string; status: "info" | "success" | "warning" | "error"; message: string; metadata?: Record<string, unknown>; notify?: boolean }) {
  await createEventLog({
    category: input.category,
    eventType: input.eventType,
    status: input.status,
    message: input.message,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
  if (input.notify) {
    const notification = composeNtfyEvent(input);
    void Promise.all([sendNtfyNotification(notification), sendChanifyNotification(notification)]);
  }
}

function serializeDirectIntegration(provider: "google_sheets" | "postgres", record: Awaited<ReturnType<typeof getIntegrationConfigByProvider>>) {
  if (!record) return { provider, configured: false, enabled: false, autoSync: false, lastCheckAt: null, lastStatus: null, lastMessage: null };
  try {
    const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as Record<string, unknown>;
    if (provider === "google_sheets") {
      return { provider, configured: true, enabled: record.enabled, autoSync: Boolean(config.autoSync), spreadsheetId: String(config.spreadsheetId ?? ""), sheetName: String(config.sheetName ?? ""), hasCredential: Boolean(config.serviceAccountJson), lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: record.lastMessage };
    }
    const connection = new URL(String(config.connectionString ?? "postgres://invalid"));
    return { provider, configured: true, enabled: record.enabled, autoSync: Boolean(config.autoSync), host: connection.host, tableName: String(config.tableName ?? "altixdev_leads"), ssl: Boolean(config.ssl), hasCredential: Boolean(config.connectionString), lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: record.lastMessage };
  } catch {
    return { provider, configured: true, enabled: false, autoSync: false, lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: "Configuração indisponível. Edite e salve novamente." };
  }
}

async function syncEnabledDirectIntegrations(lead: NonNullable<Awaited<ReturnType<typeof getLeadById>>>, trigger: "created" | "updated") {
  const providers: Array<"google_sheets" | "postgres"> = ["google_sheets", "postgres"];
  const records = await Promise.all(providers.map(async provider => ({ provider, record: await getIntegrationConfigByProvider(provider) })));
  await Promise.all(records.map(async ({ provider, record }) => {
    if (!record?.enabled) return;
    try {
      const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as { autoSync?: boolean };
      if (!config.autoSync) return;
      const result = provider === "google_sheets" ? await syncLeadToGoogleSheets(record.configCiphertext, lead) : await syncLeadToPostgres(record.configCiphertext, lead);
      if (!result.ok) throw new Error("Sincronização não concluída.");
      await recordIntegrationCheck(provider, 200, "Sincronização automática concluída.");
      await recordEvent({ category: "export", eventType: `${provider}.lead_auto_synced`, status: "success", message: `Lead #${lead.id} sincronizado automaticamente com ${provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"}.`, metadata: { provider, leadId: lead.id, trigger } });
    } catch {
      await recordIntegrationCheck(provider, null, "Falha na sincronização automática.");
      await recordEvent({ category: "export", eventType: `${provider}.lead_auto_synced`, status: "error", message: `Falha ao sincronizar automaticamente o lead #${lead.id} com ${provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"}.`, metadata: { provider, leadId: lead.id, trigger }, notify: true });
    }
  }));
}

function serializeGoogleAnalytics(record: Awaited<ReturnType<typeof getIntegrationConfigByProvider>>) {
  if (!record) return { configured: false, enabled: false, propertyId: "", hasCredential: false, lastCheckAt: null, lastStatus: null, lastMessage: null };
  try {
    const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as { propertyId?: string; measurementId?: string | null; serviceAccountJson?: string };
    return { configured: true, enabled: record.enabled, propertyId: String(config.propertyId ?? ""), measurementId: String(config.measurementId ?? ""), hasCredential: Boolean(config.serviceAccountJson), lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: record.lastMessage };
  } catch {
    return { configured: true, enabled: false, propertyId: "", hasCredential: false, lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: "Configuração indisponível. Edite e salve novamente." };
  }
}

function serializeWebhook(webhook: Awaited<ReturnType<typeof getWebhookById>>) {
  if (!webhook) return null;
  let destinationHost = "Destino configurado";
  try {
    destinationHost = new URL(decryptWebhookValue(webhook.urlCiphertext)).host;
  } catch {
    // A configuração antiga permanece editável, sem revelar informação sensível.
  }
  return {
    id: webhook.id,
    name: webhook.name,
    destinationHost,
    authHeaderName: webhook.authHeaderName,
    hasSecret: Boolean(webhook.secretCiphertext),
    enabled: webhook.enabled,
    lastTestAt: webhook.lastTestAt,
    lastStatus: webhook.lastStatus,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  };
}

const leadInputSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  phone: z.string().min(8).max(48),
  company: z.string().max(160).optional(),
  objective: z.string().min(1).max(120),
  currentChannel: z.string().min(1).max(120),
  bottleneck: z.string().min(1).max(160),
  urgency: z.string().min(1).max(64),
  consent: z.literal(true),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    adminStatus: publicProcedure.query(({ ctx }) => ({
      authenticated: Boolean(ctx.passwordAdmin),
      email: ctx.passwordAdmin ? getConfiguredAdminEmail() : null,
    })),
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!verifyAdminCredentials(input.email, input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }

        const token = await createAdminSession();
        ctx.res.cookie(ADMIN_SESSION_COOKIE, token, {
          ...getAdminSessionCookieOptions(ctx.req),
          maxAge: getAdminSessionDuration(),
        });
        return { success: true, email: getConfiguredAdminEmail(), sessionToken: token } as const;
      }),
    adminLogout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, getAdminSessionCookieOptions(ctx.req));
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  leads: router({
    create: publicProcedure.input(leadInputSchema).mutation(async ({ input }) => {
      const diagnosticSummary = [
        `Objetivo: ${input.objective}`,
        `Canal atual: ${input.currentChannel}`,
        `Gargalo: ${input.bottleneck}`,
        `Urgência: ${input.urgency}`,
      ].join(" · ");

      const id = await createLead({
        ...input,
        company: input.company?.trim() || null,
        source: "landing-page",
        diagnosticSummary,
        consentAt: new Date(),
        whatsappRedirectedAt: new Date(),
      });

      await recordEvent({
        category: "crm",
        eventType: "lead.created",
        status: "success",
        message: `Novo lead recebido: ${input.name}${input.company ? ` · ${input.company}` : ""}.`,
        metadata: { leadId: id, source: "landing-page", objective: input.objective },
        notify: true,
      });
      const lead = await getLeadById(id);
      if (lead) await syncEnabledDirectIntegrations(lead, "created");

      return { id, diagnosticSummary };
    }),
    list: adminProcedure
      .input(z.object({ search: z.string().max(120).optional(), stage: leadStageSchema.optional() }).optional())
      .query(async ({ input }) => listLeads(input)),
    metrics: adminProcedure.query(async () => {
      const records = await listLeads();
      return {
        total: records.length,
        new: records.filter(record => record.stage === "new").length,
        diagnostic: records.filter(record => record.stage === "diagnostic").length,
        proposal: records.filter(record => record.stage === "proposal").length,
        won: records.filter(record => record.stage === "won").length,
      };
    }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          stage: leadStageSchema.optional(),
          priority: leadPrioritySchema.optional(),
          notes: z.string().max(10000).nullable().optional(),
          nextStep: z.string().max(1000).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...changes } = input;
        await updateLead(id, changes);
        await recordEvent({
          category: "crm",
          eventType: "lead.updated",
          status: "success",
          message: `Lead #${id} atualizado no pipeline.`,
          metadata: { leadId: id, fields: Object.keys(changes) },
          notify: true,
        });
        const lead = await getLeadById(id);
        if (lead) await syncEnabledDirectIntegrations(lead, "updated");
        return { success: true } as const;
      }),
  }),
  logs: router({
    list: adminProcedure
      .input(z.object({ category: z.string().max(48).optional(), status: logStatusSchema.optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ input }) => {
        const records = await listEventLogs(input);
        return records.map(record => ({ ...record, metadata: record.metadata ? JSON.parse(record.metadata) : null }));
      }),
    recordExport: adminProcedure.input(z.object({ format: z.enum(["csv", "json"]), count: z.number().int().min(0).max(100000), dataType: z.enum(["leads", "logs"]).default("leads") })).mutation(async ({ input }) => {
      await recordEvent({
        category: "export",
        eventType: `${input.dataType}.exported`,
        status: "success",
        message: `${input.count} ${input.dataType === "leads" ? "lead(s)" : "evento(s) de log"} exportado(s) em ${input.format.toUpperCase()}.`,
        metadata: input,
        notify: true,
      });
      return { success: true } as const;
    }),
  }),
  directCrm: router({
    get: adminProcedure.query(async () => {
      const [googleSheets, postgres] = await Promise.all([getIntegrationConfigByProvider("google_sheets"), getIntegrationConfigByProvider("postgres")]);
      return { googleSheets: serializeDirectIntegration("google_sheets", googleSheets), postgres: serializeDirectIntegration("postgres", postgres) };
    }),
    saveGoogleSheets: adminProcedure
      .input(z.object({ serviceAccountJson: z.string().max(120000).optional(), spreadsheetId: z.string().max(256), sheetName: z.string().max(100), enabled: z.boolean(), autoSync: z.boolean().default(false) }))
      .mutation(async ({ input }) => {
        const current = await getIntegrationConfigByProvider("google_sheets");
        let existingCredential = "";
        if (current) {
          try { existingCredential = (JSON.parse(decryptWebhookValue(current.configCiphertext)) as { serviceAccountJson?: string }).serviceAccountJson ?? ""; } catch { existingCredential = ""; }
        }
        let config;
        try {
          config = validateGoogleConfig({ serviceAccountJson: input.serviceAccountJson?.trim() || existingCredential, spreadsheetId: input.spreadsheetId, sheetName: input.sheetName, autoSync: input.autoSync });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração Google Sheets inválida." });
        }
        await upsertIntegrationConfig({ provider: "google_sheets", configCiphertext: encryptWebhookValue(JSON.stringify(config)), enabled: input.enabled });
        await recordEvent({ category: "integration", eventType: "google_sheets.configured", status: "success", message: "Configuração Google Sheets atualizada.", metadata: { spreadsheetId: config.spreadsheetId, sheetName: config.sheetName, enabled: input.enabled, autoSync: config.autoSync } });
        return { success: true } as const;
      }),
    savePostgres: adminProcedure
      .input(z.object({ connectionString: z.string().max(4000).optional(), tableName: z.string().max(63), ssl: z.boolean(), enabled: z.boolean(), autoSync: z.boolean().default(false) }))
      .mutation(async ({ input }) => {
        const current = await getIntegrationConfigByProvider("postgres");
        let existingConnection = "";
        if (current) {
          try { existingConnection = (JSON.parse(decryptWebhookValue(current.configCiphertext)) as { connectionString?: string }).connectionString ?? ""; } catch { existingConnection = ""; }
        }
        let config;
        try {
          config = validatePostgresConfig({ connectionString: input.connectionString?.trim() || existingConnection, tableName: input.tableName || "altixdev_leads", ssl: input.ssl, autoSync: input.autoSync });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração PostgreSQL inválida." });
        }
        await upsertIntegrationConfig({ provider: "postgres", configCiphertext: encryptWebhookValue(JSON.stringify(config)), enabled: input.enabled });
        await recordEvent({ category: "integration", eventType: "postgres.configured", status: "success", message: "Configuração PostgreSQL atualizada.", metadata: { host: new URL(config.connectionString).host, tableName: config.tableName, enabled: input.enabled, autoSync: config.autoSync } });
        return { success: true } as const;
      }),
    test: adminProcedure.input(z.object({ provider: directProviderSchema })).mutation(async ({ input }) => {
      const record = await getIntegrationConfigByProvider(input.provider);
      if (!record) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure a integração antes de testá-la." });
      try {
        const result = input.provider === "google_sheets" ? await testGoogleSheets(record.configCiphertext) : await testPostgres(record.configCiphertext);
        await recordIntegrationCheck(input.provider, 200, "Conexão testada com sucesso.");
        await recordEvent({ category: "integration", eventType: `${input.provider}.tested`, status: "success", message: `Conexão ${input.provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"} testada com sucesso.`, metadata: result, notify: true });
        return result;
      } catch {
        await recordIntegrationCheck(input.provider, null, "Não foi possível testar a conexão.");
        await recordEvent({ category: "integration", eventType: `${input.provider}.tested`, status: "error", message: `Falha ao testar ${input.provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"}.`, metadata: { provider: input.provider }, notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível conectar. Revise as credenciais e a rede." });
      }
    }),
    syncLead: adminProcedure.input(z.object({ provider: directProviderSchema, leadId: webhookIdSchema })).mutation(async ({ input }) => {
      const [record, lead] = await Promise.all([getIntegrationConfigByProvider(input.provider), getLeadById(input.leadId)]);
      if (!record || !lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead ou integração não encontrado." });
      if (!record.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ative a integração antes de sincronizar." });
      try {
        const result = input.provider === "google_sheets" ? await syncLeadToGoogleSheets(record.configCiphertext, lead) : await syncLeadToPostgres(record.configCiphertext, lead);
        await recordIntegrationCheck(input.provider, 200, "Sincronização concluída.");
        await recordEvent({ category: "export", eventType: `${input.provider}.lead_synced`, status: "success", message: `Lead #${lead.id} sincronizado com ${input.provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"}.`, metadata: { provider: input.provider, leadId: lead.id }, notify: true });
        return result;
      } catch {
        await recordIntegrationCheck(input.provider, null, "Falha na sincronização.");
        await recordEvent({ category: "export", eventType: `${input.provider}.lead_synced`, status: "error", message: `Falha ao sincronizar o lead #${lead.id} com ${input.provider === "google_sheets" ? "Google Sheets" : "PostgreSQL"}.`, metadata: { provider: input.provider, leadId: lead.id }, notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível sincronizar o lead. Revise a integração." });
      }
    }),
  }),
  analytics: router({
    get: adminProcedure.query(async () => serializeGoogleAnalytics(await getIntegrationConfigByProvider("google_analytics"))),
    publicTag: publicProcedure.query(async () => {
      const record = await getIntegrationConfigByProvider("google_analytics");
      if (!record || !record.enabled) return { measurementId: null };
      try {
        const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as { measurementId?: string | null };
        return { measurementId: config.measurementId || null };
      } catch {
        return { measurementId: null };
      }
    }),
    save: adminProcedure
      .input(z.object({ serviceAccountJson: z.string().max(120000).optional(), propertyId: z.string().max(40), measurementId: z.string().max(32).optional(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const current = await getIntegrationConfigByProvider("google_analytics");
        let existingCredential = "";
        if (current) {
          try { existingCredential = (JSON.parse(decryptWebhookValue(current.configCiphertext)) as { serviceAccountJson?: string }).serviceAccountJson ?? ""; } catch { existingCredential = ""; }
        }
        let config;
        try {
          config = validateGoogleAnalyticsConfig({ serviceAccountJson: input.serviceAccountJson?.trim() || existingCredential, propertyId: input.propertyId, measurementId: input.measurementId });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração GA4 inválida." });
        }
        await upsertIntegrationConfig({ provider: "google_analytics", configCiphertext: encryptWebhookValue(JSON.stringify(config)), enabled: input.enabled });
        await recordEvent({ category: "integration", eventType: "google_analytics.configured", status: "success", message: "Configuração Google Analytics atualizada.", metadata: { propertyId: config.propertyId, measurementId: config.measurementId || null, enabled: input.enabled } });
        return { success: true } as const;
      }),
    test: adminProcedure.mutation(async () => {
      const record = await getIntegrationConfigByProvider("google_analytics");
      if (!record) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure o Google Analytics antes de testá-lo." });
      try {
        const result = await testGoogleAnalytics(record.configCiphertext);
        await recordIntegrationCheck("google_analytics", 200, "Conexão GA4 testada com sucesso.");
        await recordEvent({ category: "integration", eventType: "google_analytics.tested", status: "success", message: "Conexão Google Analytics testada com sucesso.", metadata: { propertyId: result.propertyId }, notify: true });
        return result;
      } catch {
        await recordIntegrationCheck("google_analytics", null, "Não foi possível testar a conexão GA4.");
        await recordEvent({ category: "integration", eventType: "google_analytics.tested", status: "error", message: "Falha ao testar Google Analytics.", notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível conectar ao GA4. Revise a propriedade e o acesso da conta de serviço." });
      }
    }),
    overview: adminProcedure.query(async () => {
      const record = await getIntegrationConfigByProvider("google_analytics");
      if (!record || !record.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ative e configure o Google Analytics para carregar as métricas." });
      try {
        const overview = await getGoogleAnalyticsOverview(record.configCiphertext);
        await recordIntegrationCheck("google_analytics", 200, "Métricas GA4 atualizadas.");
        return overview;
      } catch {
        await recordIntegrationCheck("google_analytics", null, "Não foi possível atualizar as métricas GA4.");
        await recordEvent({ category: "integration", eventType: "google_analytics.metrics_failed", status: "error", message: "Falha ao atualizar métricas Google Analytics.", notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível carregar as métricas GA4." });
      }
    }),
  }),
  ntfy: router({
    get: adminProcedure.query(async () => {
      const record = await getIntegrationConfigByProvider("ntfy");
      if (!record) return { configured: false, enabled: false, serverUrl: "https://ntfy.sh", topic: "", hasToken: false, lastCheckAt: null, lastStatus: null, lastMessage: null };
      try {
        const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as { serverUrl: string; topic: string; token?: string | null };
        return { configured: true, enabled: record.enabled, serverUrl: config.serverUrl, topic: config.topic, hasToken: Boolean(config.token), lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: record.lastMessage };
      } catch {
        return { configured: true, enabled: false, serverUrl: "", topic: "", hasToken: false, lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: "Configuração indisponível. Edite e salve novamente." };
      }
    }),
    save: adminProcedure
      .input(z.object({ serverUrl: z.string().url().max(1000), topic: z.string().max(64), token: z.string().max(2000).optional(), removeToken: z.boolean().default(false), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const current = await getIntegrationConfigByProvider("ntfy");
        let existingToken: string | null = null;
        if (current) {
          try { existingToken = (JSON.parse(decryptWebhookValue(current.configCiphertext)) as { token?: string | null }).token ?? null; } catch { existingToken = null; }
        }
        let config;
        try {
          config = validateNtfyConfig({ serverUrl: input.serverUrl, topic: input.topic, token: input.removeToken ? null : input.token?.trim() || existingToken });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração ntfy inválida." });
        }
        await upsertIntegrationConfig({ provider: "ntfy", configCiphertext: encryptWebhookValue(JSON.stringify(config)), enabled: input.enabled });
        await recordEvent({ category: "integration", eventType: "ntfy.configured", status: "success", message: "Configuração ntfy atualizada.", metadata: { enabled: input.enabled, host: new URL(config.serverUrl).host } });
        return { success: true } as const;
    }),
    test: adminProcedure.mutation(async () => {
      const result = await sendNtfyNotification(composeNtfyEvent({ eventType: "ntfy.tested", status: "success", message: "Conexao com o painel confirmada. Alertas de leads, CRM e integracoes estao prontos." }));
      await recordEvent({ category: "integration", eventType: "ntfy.tested", status: result.ok ? "success" : "error", message: result.ok ? "Teste de notificação ntfy enviado." : "Falha ao testar a notificação ntfy.", metadata: { status: result.status } });
      return result;
    }),
  }),
  chanify: router({
    get: adminProcedure.query(async () => {
      const record = await getIntegrationConfigByProvider("chanify");
      if (!record) return { configured: false, enabled: false, hasToken: false, serverUrl: "https://api.chanify.net", lastCheckAt: null, lastStatus: null, lastMessage: null };
      try {
        const config = JSON.parse(decryptWebhookValue(record.configCiphertext)) as { token?: string; serverUrl?: string };
        return { configured: true, enabled: record.enabled, hasToken: Boolean(config.token), serverUrl: config.serverUrl || "https://api.chanify.net", lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: record.lastMessage };
      } catch {
        return { configured: true, enabled: false, hasToken: false, serverUrl: "https://api.chanify.net", lastCheckAt: record.lastCheckAt, lastStatus: record.lastStatus, lastMessage: "Configuração indisponível. Edite e salve novamente." };
      }
    }),
    save: adminProcedure
      .input(z.object({ serverUrl: z.string().url().max(512).optional(), token: z.string().max(512).optional(), removeToken: z.boolean().default(false), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const current = await getIntegrationConfigByProvider("chanify");
        let existingToken = "";
        let existingServerUrl = "https://api.chanify.net";
        if (current) {
          try {
            const existing = JSON.parse(decryptWebhookValue(current.configCiphertext)) as { token?: string; serverUrl?: string };
            existingToken = existing.token ?? "";
            existingServerUrl = existing.serverUrl ?? existingServerUrl;
          } catch { existingToken = ""; }
        }
        let config;
        try {
          config = validateChanifyConfig({ token: input.removeToken ? "" : input.token?.trim() || existingToken, serverUrl: input.serverUrl?.trim() || existingServerUrl });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração Chanify inválida." });
        }
        await upsertIntegrationConfig({ provider: "chanify", configCiphertext: encryptWebhookValue(JSON.stringify(config)), enabled: input.enabled });
        await recordEvent({ category: "integration", eventType: "chanify.configured", status: "success", message: "Configuração Chanify atualizada.", metadata: { enabled: input.enabled } });
        return { success: true } as const;
      }),
    test: adminProcedure.mutation(async () => {
      const result = await sendChanifyNotification(composeNtfyEvent({ eventType: "chanify.tested", status: "success", message: "Conexao com o painel confirmada. Alertas comerciais estao prontos." }));
      await recordEvent({ category: "integration", eventType: "chanify.tested", status: result.ok ? "success" : "error", message: result.ok ? "Teste de notificação Chanify enviado." : "Falha ao testar a notificação Chanify.", metadata: { status: result.status } });
      return result;
    }),
  }),
  webhooks: router({
    list: adminProcedure.query(async () => {
      const records = await listWebhooks();
      return records.map(record => serializeWebhook(record));
    }),
    create: adminProcedure.input(webhookInputSchema).mutation(async ({ input }) => {
      let url: string;
      try {
        url = validateWebhookUrl(input.url);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "URL de webhook inválida." });
      }
      const id = await createWebhook({
        name: input.name,
        urlCiphertext: encryptWebhookValue(url),
        authHeaderName: input.authHeaderName || null,
        secretCiphertext: input.secret ? encryptWebhookValue(input.secret) : null,
        enabled: input.enabled,
      });
      const record = await getWebhookById(id);
      await recordEvent({ category: "integration", eventType: "webhook.created", status: "success", message: `Webhook “${input.name}” criado.`, metadata: { webhookId: id } });
      return serializeWebhook(record);
    }),
    update: adminProcedure
      .input(webhookInputSchema.partial().extend({ id: webhookIdSchema }))
      .mutation(async ({ input }) => {
        const current = await getWebhookById(input.id);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook não encontrado." });
        const { id, url, secret, authHeaderName, ...rest } = input;
        const changes: Parameters<typeof updateWebhook>[1] = { ...rest };
        if (url !== undefined) {
          try {
            changes.urlCiphertext = encryptWebhookValue(validateWebhookUrl(url));
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "URL de webhook inválida." });
          }
        }
        if (authHeaderName !== undefined) changes.authHeaderName = authHeaderName || null;
        if (secret !== undefined) changes.secretCiphertext = secret ? encryptWebhookValue(secret) : null;
        await updateWebhook(id, changes);
        await recordEvent({ category: "integration", eventType: "webhook.updated", status: "success", message: `Webhook #${id} atualizado.`, metadata: { webhookId: id } });
        return serializeWebhook(await getWebhookById(id));
      }),
    delete: adminProcedure.input(z.object({ id: webhookIdSchema })).mutation(async ({ input }) => {
      await deleteWebhook(input.id);
      await recordEvent({ category: "integration", eventType: "webhook.deleted", status: "warning", message: `Webhook #${input.id} removido.`, metadata: { webhookId: input.id } });
      return { success: true } as const;
    }),
    test: adminProcedure.input(z.object({ id: webhookIdSchema })).mutation(async ({ input }) => {
      const webhook = await getWebhookById(input.id);
      if (!webhook) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook não encontrado." });
      try {
        const result = await postWebhook(
          {
            url: decryptWebhookValue(webhook.urlCiphertext),
            authHeaderName: webhook.authHeaderName,
            secret: webhook.secretCiphertext ? decryptWebhookValue(webhook.secretCiphertext) : null,
          },
          createWebhookTestPayload(webhook.name),
        );
        await recordWebhookTest(webhook.id, result.status);
        await recordEvent({ category: "integration", eventType: "webhook.tested", status: result.ok ? "success" : "error", message: result.ok ? `Teste do webhook “${webhook.name}” concluído.` : `Webhook “${webhook.name}” respondeu com erro.`, metadata: { webhookId: webhook.id, status: result.status }, notify: true });
        return result;
      } catch {
        await recordWebhookTest(webhook.id, null);
        await recordEvent({ category: "integration", eventType: "webhook.tested", status: "error", message: `Falha ao testar o webhook “${webhook.name}”.`, metadata: { webhookId: webhook.id }, notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível alcançar o webhook. Revise a URL e o segredo." });
      }
    }),
    sendLead: adminProcedure.input(z.object({ id: webhookIdSchema, leadId: webhookIdSchema })).mutation(async ({ input }) => {
      const [webhook, lead] = await Promise.all([getWebhookById(input.id), getLeadById(input.leadId)]);
      if (!webhook || !lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead ou webhook não encontrado." });
      if (!webhook.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ative o webhook antes de enviar um lead." });
      try {
        const result = await postWebhook(
          {
            url: decryptWebhookValue(webhook.urlCiphertext),
            authHeaderName: webhook.authHeaderName,
            secret: webhook.secretCiphertext ? decryptWebhookValue(webhook.secretCiphertext) : null,
          },
          createLeadWebhookPayload(lead),
        );
        await recordWebhookTest(webhook.id, result.status);
        await recordEvent({ category: "export", eventType: "lead.sent_to_webhook", status: result.ok ? "success" : "error", message: result.ok ? `Lead #${lead.id} enviado ao webhook “${webhook.name}”.` : `Webhook “${webhook.name}” respondeu com erro ao receber o lead.`, metadata: { webhookId: webhook.id, leadId: lead.id, status: result.status }, notify: true });
        return result;
      } catch {
        await recordEvent({ category: "export", eventType: "lead.sent_to_webhook", status: "error", message: `Falha ao enviar o lead #${lead.id} ao webhook “${webhook.name}”.`, metadata: { webhookId: webhook.id, leadId: lead.id }, notify: true });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível enviar o lead ao webhook." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
