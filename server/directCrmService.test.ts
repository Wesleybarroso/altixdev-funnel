import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../drizzle/schema";

const sheetsMocks = vi.hoisted(() => ({ append: vi.fn(), get: vi.fn(), update: vi.fn() }));
const cryptoMocks = vi.hoisted(() => ({ decryptWebhookValue: vi.fn(), validateWebhookUrl: vi.fn((url: string) => url) }));

vi.mock("googleapis", () => ({ google: { auth: { GoogleAuth: vi.fn() }, sheets: vi.fn(() => ({ spreadsheets: { values: sheetsMocks } })) } }));
vi.mock("./webhookService", () => cryptoMocks);

import { findGoogleSheetLeadRow, syncLeadToGoogleSheets } from "./directCrmService";

const lead: Lead = { id: 42, name: "Ana", email: "ana@empresa.com", phone: "5591999999999", company: "Empresa Teste", stage: "proposal", priority: "high", source: "landing-page", objective: "Gerar mais oportunidades", currentChannel: "Instagram", bottleneck: "Conversão", urgency: "Agora", diagnosticSummary: "Resumo", notes: null, nextStep: null, consent: true, consentAt: new Date(), whatsappRedirectedAt: new Date(), createdAt: new Date("2026-08-22T12:00:00Z"), updatedAt: new Date("2026-08-22T12:00:00Z") };
const config = JSON.stringify({ serviceAccountJson: JSON.stringify({ client_email: "reader@example.iam.gserviceaccount.com", private_key: "TEST" }), spreadsheetId: "spreadsheet-123", sheetName: "Leads" });

describe("Google Sheets lead synchronization", () => {
  beforeEach(() => { vi.clearAllMocks(); cryptoMocks.decryptWebhookValue.mockReturnValue(config); });

  it("localiza a linha existente pelo source_lead_id", () => {
    expect(findGoogleSheetLeadRow([["8"], ["42"], ["105"]], 42)).toBe(3);
    expect(findGoogleSheetLeadRow([["8"], ["105"]], 42)).toBeNull();
    expect(findGoogleSheetLeadRow(null, 42)).toBeNull();
  });

  it("atualiza a linha de um lead existente sem chamar append", async () => {
    sheetsMocks.get.mockResolvedValueOnce({ data: { values: [["source_lead_id", "name"]] } }).mockResolvedValueOnce({ data: { values: [["42"]] } });
    await expect(syncLeadToGoogleSheets("ciphertext", lead)).resolves.toEqual({ ok: true, updated: true });
    expect(sheetsMocks.update).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: "spreadsheet-123", range: "'Leads'!A2:R2", requestBody: expect.objectContaining({ values: [expect.arrayContaining([42, "Ana"])] }) }));
    expect(sheetsMocks.append).not.toHaveBeenCalled();
  });

  it("anexa apenas um lead novo quando não encontra source_lead_id existente", async () => {
    sheetsMocks.get.mockResolvedValueOnce({ data: { values: [["source_lead_id", "name"]] } }).mockResolvedValueOnce({ data: { values: [] } });
    await expect(syncLeadToGoogleSheets("ciphertext", lead)).resolves.toEqual({ ok: true, updated: false });
    expect(sheetsMocks.append).toHaveBeenCalledTimes(1);
    expect(sheetsMocks.append).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: "spreadsheet-123", range: "'Leads'!A:R", requestBody: expect.objectContaining({ values: [expect.arrayContaining([42, "Ana"])] }) }));
    expect(sheetsMocks.update).not.toHaveBeenCalled();
  });
});
