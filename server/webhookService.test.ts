import { describe, expect, it } from "vitest";
import { createLeadWebhookPayload, validateWebhookUrl } from "./webhookService";

describe("webhookService", () => {
  it("aceita apenas destinos HTTPS públicos", () => {
    expect(validateWebhookUrl("https://automation.example.com/webhook/leads")).toBe("https://automation.example.com/webhook/leads");
    expect(() => validateWebhookUrl("http://automation.example.com/webhook")).toThrow("URL pública com HTTPS");
    expect(() => validateWebhookUrl("https://localhost/webhook")).toThrow("URL pública com HTTPS");
    expect(() => validateWebhookUrl("https://192.168.1.10/webhook")).toThrow("URL pública com HTTPS");
  });

  it("mapeia o lead em formato legível por automações e CRM", () => {
    const timestamp = new Date("2026-08-22T12:00:00.000Z");
    const payload = createLeadWebhookPayload({
      id: 7,
      name: "Ana Souza",
      email: "ana@empresa.com",
      phone: "5591999999999",
      company: "Empresa Teste",
      source: "landing-page",
      objective: "Gerar oportunidades",
      currentChannel: "Instagram",
      bottleneck: "Resposta lenta",
      urgency: "Este mês",
      diagnosticSummary: "Diagnóstico completo",
      consent: true,
      consentAt: timestamp,
      whatsappRedirectedAt: timestamp,
      stage: "diagnostic",
      priority: "high",
      notes: "Retornar na terça",
      nextStep: "Agendar reunião",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(payload.event).toBe("altixdev.lead.exported");
    expect(payload.lead).toMatchObject({ id: 7, name: "Ana Souza", stage: "diagnostic", priority: "high" });
    expect(payload.crm).toMatchObject({ contact_name: "Ana Souza", lifecycle_stage: "diagnostic", lead_priority: "high" });
  });
});
