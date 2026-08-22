import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const databaseMocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  createEventLog: vi.fn(),
  getIntegrationConfigByProvider: vi.fn(),
  getLeadById: vi.fn(),
  listLeads: vi.fn(),
  recordIntegrationCheck: vi.fn(),
  updateLead: vi.fn(),
}));

const ntfyMocks = vi.hoisted(() => ({
  composeNtfyEvent: vi.fn((input: { message: string }) => ({ title: "Altixdev · Teste", message: input.message })),
  sendNtfyNotification: vi.fn(),
  validateNtfyConfig: vi.fn(),
}));

const directCrmMocks = vi.hoisted(() => ({
  syncLeadToGoogleSheets: vi.fn(),
  syncLeadToPostgres: vi.fn(),
  testGoogleSheets: vi.fn(),
  testPostgres: vi.fn(),
  validateGoogleConfig: vi.fn(),
  validatePostgresConfig: vi.fn(),
}));

const webhookCryptoMocks = vi.hoisted(() => ({
  decryptWebhookValue: vi.fn(),
  encryptWebhookValue: vi.fn(),
  validateWebhookUrl: vi.fn(),
  createLeadWebhookPayload: vi.fn(),
  createWebhookTestPayload: vi.fn(),
  postWebhook: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);
vi.mock("./ntfyService", () => ntfyMocks);
vi.mock("./directCrmService", () => directCrmMocks);
vi.mock("./webhookService", () => webhookCryptoMocks);

import { appRouter } from "./routers";

function createContext(role: "admin" | "user", passwordAdmin = false): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `test-${role}`,
      name: "Wesley",
      email: "wesley@altixdev.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    passwordAdmin,
  };
}

describe("leads router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra diagnóstico consentido e preserva seu contexto comercial", async () => {
    databaseMocks.createLead.mockResolvedValue(42);
    const caller = appRouter.createCaller(createContext("user"));

    const result = await caller.leads.create({
      name: "Ana",
      email: "ana@empresa.com",
      phone: "5591999999999",
      company: "Empresa Teste",
      objective: "Gerar mais oportunidades",
      currentChannel: "Instagram",
      bottleneck: "Leads não recebem resposta a tempo",
      urgency: "Quero começar nas próximas semanas",
      consent: true,
    });

    expect(result.id).toBe(42);
    expect(result.diagnosticSummary).toContain("Objetivo: Gerar mais oportunidades");
    expect(result.diagnosticSummary).toContain("Canal atual: Instagram");
    expect(databaseMocks.createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "landing-page",
        consent: true,
        diagnosticSummary: expect.stringContaining("Gargalo: Leads não recebem resposta a tempo"),
      }),
    );
  });

  it("impede usuários comuns de listar os leads privados", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.leads.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita a captura quando o consentimento não é concedido", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.leads.create({
        name: "Ana",
        email: "ana@empresa.com",
        phone: "5591999999999",
        objective: "Gerar mais oportunidades",
        currentChannel: "Instagram",
        bottleneck: "Leads não recebem resposta a tempo",
        urgency: "Quero começar nas próximas semanas",
        consent: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(databaseMocks.createLead).not.toHaveBeenCalled();
  });

  it("permite ao administrador atualizar estágio, prioridade e próximo passo", async () => {
    databaseMocks.updateLead.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext("admin", true));

    await expect(
      caller.leads.update({ id: 7, stage: "proposal", priority: "high", nextStep: "Enviar proposta revisada" }),
    ).resolves.toEqual({ success: true });

    expect(databaseMocks.updateLead).toHaveBeenCalledWith(7, {
      stage: "proposal",
      priority: "high",
      nextStep: "Enviar proposta revisada",
    });
  });

  it("sincroniza automaticamente novos leads e atualizações quando o administrador ativa esse comportamento", async () => {
    const lead = { id: 42, name: "Ana", email: "ana@empresa.com", phone: "5591999999999", company: "Empresa Teste", stage: "proposal", priority: "high", source: "landing-page", objective: "Gerar mais oportunidades", currentChannel: "Instagram", bottleneck: "Leads não recebem resposta a tempo", urgency: "Quero começar nas próximas semanas", diagnosticSummary: "Resumo", notes: null, nextStep: null, consent: true, consentAt: new Date(), whatsappRedirectedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
    databaseMocks.createLead.mockResolvedValue(42);
    databaseMocks.getLeadById.mockResolvedValue(lead);
    databaseMocks.getIntegrationConfigByProvider.mockImplementation((provider: string) => provider === "google_sheets" ? { enabled: true, configCiphertext: "google-config" } : provider === "postgres" ? { enabled: true, configCiphertext: "postgres-config" } : undefined);
    webhookCryptoMocks.decryptWebhookValue.mockReturnValue('{"autoSync":true}');
    directCrmMocks.syncLeadToGoogleSheets.mockResolvedValue({ ok: true });
    directCrmMocks.syncLeadToPostgres.mockResolvedValue({ ok: true });
    const publicCaller = appRouter.createCaller(createContext("user"));
    const adminCaller = appRouter.createCaller(createContext("admin", true));

    await publicCaller.leads.create({ name: "Ana", email: "ana@empresa.com", phone: "5591999999999", company: "Empresa Teste", objective: "Gerar mais oportunidades", currentChannel: "Instagram", bottleneck: "Leads não recebem resposta a tempo", urgency: "Quero começar nas próximas semanas", consent: true });
    await adminCaller.leads.update({ id: 42, stage: "proposal" });

    expect(directCrmMocks.syncLeadToGoogleSheets).toHaveBeenCalledWith("google-config", lead);
    expect(directCrmMocks.syncLeadToPostgres).toHaveBeenCalledWith("postgres-config", lead);
    expect(databaseMocks.recordIntegrationCheck).toHaveBeenCalledWith("google_sheets", 200, "Sincronização automática concluída.");
    expect(databaseMocks.recordIntegrationCheck).toHaveBeenCalledWith("postgres", 200, "Sincronização automática concluída.");
  });
});
