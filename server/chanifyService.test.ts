import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({ getIntegrationConfigByProvider: vi.fn(), recordIntegrationCheck: vi.fn() }));
const cryptoMocks = vi.hoisted(() => ({ decryptWebhookValue: vi.fn(), validateWebhookUrl: vi.fn((value: string) => value) }));

vi.mock("./db", () => databaseMocks);
vi.mock("./webhookService", () => cryptoMocks);

import { sendChanifyNotification, validateChanifyConfig } from "./chanifyService";

describe("notificações Chanify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue({ enabled: true, configCiphertext: "ciphertext" });
    cryptoMocks.decryptWebhookValue.mockReturnValue(JSON.stringify({ token: "chanify-token-123", serverUrl: "https://api.chanify.net" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("valida token, endpoint HTTPS e não aceita valores vazios", () => {
    expect(validateChanifyConfig({ token: " chanify-token-123 ", serverUrl: "https://chanify.altixdev.com/" })).toEqual({ token: "chanify-token-123", serverUrl: "https://chanify.altixdev.com" });
    expect(() => validateChanifyConfig({ token: "" })).toThrow("token Chanify");
  });

  it("envia título e mensagem em formulário para a API Chanify", async () => {
    await expect(sendChanifyNotification({ title: "ALTIXDEV | Novo lead", message: "Contato recebido.", tags: ["briefcase"] })).resolves.toEqual({ skipped: false, ok: true, status: 200 });

    const [target, request] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(target).toBe("https://api.chanify.net/v1/sender/chanify-token-123");
    expect(request.headers).toEqual({ "content-type": "application/x-www-form-urlencoded; charset=utf-8" });
    expect(request.body.toString()).toBe("text=ALTIXDEV+%7C+Novo+lead%0AContato+recebido.");
    expect(databaseMocks.recordIntegrationCheck).toHaveBeenCalledWith("chanify", 200, "Notificação Chanify entregue.");
  });

  it("envia para o endpoint próprio salvo na configuração", async () => {
    cryptoMocks.decryptWebhookValue.mockReturnValue(JSON.stringify({ token: "chanify-token-123", serverUrl: "https://chanify.altixdev.com" }));
    await sendChanifyNotification({ title: "ALTIXDEV | CRM atualizado", message: "Lead em proposta." });
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("https://chanify.altixdev.com/v1/sender/chanify-token-123");
  });
});
