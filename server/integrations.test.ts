import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const databaseMocks = vi.hoisted(() => ({
  createEventLog: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  getIntegrationConfigByProvider: vi.fn(),
  getLeadById: vi.fn(),
  getWebhookById: vi.fn(),
  listEventLogs: vi.fn(),
  listWebhooks: vi.fn(),
  recordIntegrationCheck: vi.fn(),
  recordWebhookTest: vi.fn(),
  updateWebhook: vi.fn(),
  upsertIntegrationConfig: vi.fn(),
}));

const ntfyMocks = vi.hoisted(() => ({
  composeNtfyEvent: vi.fn((input: { message: string }) => ({ title: "Altixdev · Teste", message: input.message })),
  sendNtfyNotification: vi.fn(),
  validateNtfyConfig: vi.fn(),
}));

const chanifyMocks = vi.hoisted(() => ({
  sendChanifyNotification: vi.fn(),
  validateChanifyConfig: vi.fn(),
}));

const googleAnalyticsMocks = vi.hoisted(() => ({
  getGoogleAnalyticsOverview: vi.fn(),
  testGoogleAnalytics: vi.fn(),
  validateGoogleAnalyticsConfig: vi.fn(),
}));

const webhookCryptoMocks = vi.hoisted(() => ({
  encryptWebhookValue: vi.fn((value: string) => `encrypted:${value}`),
  decryptWebhookValue: vi.fn(),
  validateWebhookUrl: vi.fn(),
  createLeadWebhookPayload: vi.fn(),
  createWebhookTestPayload: vi.fn(),
  postWebhook: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);
vi.mock("./ntfyService", () => ntfyMocks);
vi.mock("./chanifyService", () => chanifyMocks);
vi.mock("./webhookService", () => webhookCryptoMocks);
vi.mock("./googleAnalyticsService", () => googleAnalyticsMocks);

import { appRouter } from "./routers";

function createContext(passwordAdmin: boolean): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], passwordAdmin };
}

describe("integrações e logs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloqueia logs para quem não possui a sessão administrativa", async () => {
    const caller = appRouter.createCaller(createContext(false));
    await expect(caller.logs.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bloqueia mutações de webhook e exportações para quem não possui a sessão administrativa", async () => {
    const caller = appRouter.createCaller(createContext(false));
    await expect(caller.webhooks.create({ name: "CRM", url: "https://crm.example.com/hook", enabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.webhooks.update({ id: 7, enabled: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.webhooks.delete({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.webhooks.test({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.webhooks.sendLead({ id: 7, leadId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.logs.recordExport({ format: "csv", count: 1, dataType: "logs" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("guarda a configuração ntfy cifrada e não expõe o token na resposta", async () => {
    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue(undefined);
    ntfyMocks.validateNtfyConfig.mockReturnValue({ serverUrl: "https://ntfy.sh", topic: "altixdev_private_topic", token: "tk_secret" });
    const caller = appRouter.createCaller(createContext(true));

    await expect(caller.ntfy.save({ serverUrl: "https://ntfy.sh", topic: "altixdev_private_topic", token: "tk_secret", enabled: true })).resolves.toEqual({ success: true });

    expect(databaseMocks.upsertIntegrationConfig).toHaveBeenCalledWith(expect.objectContaining({
      provider: "ntfy",
      configCiphertext: expect.stringContaining("encrypted:"),
      enabled: true,
    }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "ntfy.configured" }));
  });

  it("protege a configuração Chanify e registra o teste sem expor o token", async () => {
    const anonymous = appRouter.createCaller(createContext(false));
    await expect(anonymous.chanify.get()).rejects.toMatchObject({ code: "FORBIDDEN" });

    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue(undefined);
    chanifyMocks.validateChanifyConfig.mockReturnValue({ token: "chanify-secret-token" });
    const caller = appRouter.createCaller(createContext(true));
    await expect(caller.chanify.save({ token: "chanify-secret-token", enabled: true })).resolves.toEqual({ success: true });
    expect(databaseMocks.upsertIntegrationConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: "chanify", configCiphertext: expect.stringContaining("encrypted:"), enabled: true }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "chanify.configured" }));
    expect(databaseMocks.createEventLog).not.toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.stringContaining("chanify-secret-token") }));

    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue({ enabled: true, configCiphertext: "encrypted:chanify" });
    chanifyMocks.sendChanifyNotification.mockResolvedValue({ ok: true, status: 200 });
    await expect(caller.chanify.test()).resolves.toEqual({ ok: true, status: 200 });
    expect(ntfyMocks.composeNtfyEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "chanify.tested", status: "success" }));
    expect(chanifyMocks.sendChanifyNotification).toHaveBeenCalledWith(expect.objectContaining({ message: "Conexao com o painel confirmada. Alertas comerciais estao prontos." }));
  });

  it("bloqueia a configuração Google Analytics sem sessão administrativa", async () => {
    const caller = appRouter.createCaller(createContext(false));
    await expect(caller.analytics.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("guarda a credencial GA4 cifrada e registra apenas o ID da propriedade", async () => {
    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue(undefined);
    googleAnalyticsMocks.validateGoogleAnalyticsConfig.mockReturnValue({ serviceAccountJson: '{"type":"service_account","private_key":"secret"}', propertyId: "123456789" });
    const caller = appRouter.createCaller(createContext(true));

    await expect(caller.analytics.save({ serviceAccountJson: '{"type":"service_account","private_key":"secret"}', propertyId: "123456789", enabled: true })).resolves.toEqual({ success: true });

    expect(databaseMocks.upsertIntegrationConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: "google_analytics", configCiphertext: expect.stringContaining("encrypted:"), enabled: true }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "google_analytics.configured", metadata: expect.stringContaining("123456789") }));
    expect(databaseMocks.createEventLog).not.toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.stringContaining("private_key") }));
  });

  it("cria, edita e exclui um webhook sem retornar a URL ou o segredo", async () => {
    const record = { id: 7, name: "CRM externo", urlCiphertext: "encrypted:https://crm.example.com/hook", authHeaderName: "Authorization", secretCiphertext: "encrypted:token", enabled: true, lastTestAt: null, lastStatus: null, createdAt: new Date(), updatedAt: new Date() };
    webhookCryptoMocks.validateWebhookUrl.mockReturnValue("https://crm.example.com/hook");
    webhookCryptoMocks.decryptWebhookValue.mockImplementation((value: string) => value.replace("encrypted:", ""));
    databaseMocks.createWebhook.mockResolvedValue(7);
    databaseMocks.getWebhookById.mockResolvedValue(record);
    const caller = appRouter.createCaller(createContext(true));

    await expect(caller.webhooks.create({ name: "CRM externo", url: "https://crm.example.com/hook", authHeaderName: "Authorization", secret: "token", enabled: true })).resolves.toEqual(expect.objectContaining({ id: 7, destinationHost: "crm.example.com", hasSecret: true }));
    expect(databaseMocks.createWebhook).toHaveBeenCalledWith(expect.objectContaining({ urlCiphertext: expect.stringContaining("encrypted:"), secretCiphertext: expect.stringContaining("encrypted:") }));

    await expect(caller.webhooks.update({ id: 7, name: "CRM atualizado", enabled: false })).resolves.toEqual(expect.objectContaining({ id: 7, destinationHost: "crm.example.com" }));
    expect(databaseMocks.updateWebhook).toHaveBeenCalledWith(7, expect.objectContaining({ name: "CRM atualizado", enabled: false }));

    await expect(caller.webhooks.delete({ id: 7 })).resolves.toEqual({ success: true });
    expect(databaseMocks.deleteWebhook).toHaveBeenCalledWith(7);
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "webhook.created" }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "webhook.updated" }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "webhook.deleted" }));
  });

  it("testa e envia lead pelo webhook com registro de resultado", async () => {
    const webhook = { id: 7, name: "CRM externo", urlCiphertext: "encrypted:https://crm.example.com/hook", authHeaderName: null, secretCiphertext: null, enabled: true, lastTestAt: null, lastStatus: null, createdAt: new Date(), updatedAt: new Date() };
    const lead = { id: 3, name: "Lead teste", email: "lead@example.com", phone: "5591999999999", company: null, stage: "new", priority: "medium", source: "landing-page", objective: "Mais leads", currentChannel: "Site", bottleneck: "Conversão", urgency: "Agora", diagnosticSummary: "Resumo", notes: null, nextStep: null, consent: true, consentAt: new Date(), whatsappRedirectedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
    webhookCryptoMocks.decryptWebhookValue.mockImplementation((value: string) => value.replace("encrypted:", ""));
    webhookCryptoMocks.createWebhookTestPayload.mockReturnValue({ event: "webhook.test" });
    webhookCryptoMocks.createLeadWebhookPayload.mockReturnValue({ event: "lead.created" });
    webhookCryptoMocks.postWebhook.mockResolvedValue({ ok: true, status: 200 });
    databaseMocks.getWebhookById.mockResolvedValue(webhook);
    databaseMocks.getLeadById.mockResolvedValue(lead);
    const caller = appRouter.createCaller(createContext(true));

    await expect(caller.webhooks.test({ id: 7 })).resolves.toEqual({ ok: true, status: 200 });
    await expect(caller.webhooks.sendLead({ id: 7, leadId: 3 })).resolves.toEqual({ ok: true, status: 200 });

    expect(databaseMocks.recordWebhookTest).toHaveBeenCalledWith(7, 200);
    expect(webhookCryptoMocks.postWebhook).toHaveBeenCalledTimes(2);
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "webhook.tested", status: "success" }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "lead.sent_to_webhook", status: "success" }));
  });

  it("registra as exportações CSV e JSON de leads e logs", async () => {
    const caller = appRouter.createCaller(createContext(true));
    await expect(caller.logs.recordExport({ format: "csv", count: 2, dataType: "leads" })).resolves.toEqual({ success: true });
    await expect(caller.logs.recordExport({ format: "json", count: 1, dataType: "logs" })).resolves.toEqual({ success: true });
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "leads.exported", metadata: expect.stringContaining("csv") }));
    expect(databaseMocks.createEventLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: "logs.exported", metadata: expect.stringContaining("json") }));
  });
});
