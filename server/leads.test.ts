import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const databaseMocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  createEventLog: vi.fn(),
  listLeads: vi.fn(),
  updateLead: vi.fn(),
}));

const ntfyMocks = vi.hoisted(() => ({
  sendNtfyNotification: vi.fn(),
  validateNtfyConfig: vi.fn(),
}));

vi.mock("./db", () => databaseMocks);
vi.mock("./ntfyService", () => ntfyMocks);

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
});
