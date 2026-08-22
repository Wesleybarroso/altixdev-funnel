import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({ getIntegrationConfigByProvider: vi.fn(), recordIntegrationCheck: vi.fn() }));
const cryptoMocks = vi.hoisted(() => ({ decryptWebhookValue: vi.fn(), validateWebhookUrl: vi.fn((url: string) => url) }));

vi.mock("./db", () => databaseMocks);
vi.mock("./webhookService", () => cryptoMocks);

import { composeNtfyEvent, sendNtfyNotification } from "./ntfyService";

describe("notificações ntfy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.getIntegrationConfigByProvider.mockResolvedValue({ enabled: true, configCiphertext: "ciphertext" });
    cryptoMocks.decryptWebhookValue.mockReturnValue(JSON.stringify({ serverUrl: "https://ntfy.sh", topic: "altixdev_private" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("compõe títulos e ícones coerentes com o evento", () => {
    expect(composeNtfyEvent({ eventType: "lead.created", status: "success", message: "Novo contato" })).toEqual(expect.objectContaining({ title: "ALTIXDEV | Novo lead", tags: ["briefcase", "arrow_up"] }));
    expect(composeNtfyEvent({ eventType: "postgres.lead_synced", status: "success", message: "Sincronizado" })).toEqual(expect.objectContaining({ title: "ALTIXDEV | Lead sincronizado" }));
    expect(composeNtfyEvent({ eventType: "webhook.tested", status: "error", message: "Falha" })).toEqual(expect.objectContaining({ title: "ALTIXDEV | Atencao necessaria", priority: "high" }));
  });

  it("envia JSON UTF-8 para preservar acentos e evita caracteres quebrados", async () => {
    await expect(sendNtfyNotification({ title: "Altixdev · Integração verificada", message: "A conexão está funcionando.", priority: "default", tags: ["electric_plug", "white_check_mark"] })).resolves.toEqual({ skipped: false, ok: true, status: 200 });

    const [target, request] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(target).toBe("https://ntfy.sh/altixdev_private");
    expect(request.headers).toEqual({ "content-type": "application/json; charset=utf-8" });
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({ title: "Altixdev · Integração verificada", message: "A conexão está funcionando.", tags: ["electric_plug", "white_check_mark"] }));
    expect(databaseMocks.recordIntegrationCheck).toHaveBeenCalledWith("ntfy", 200, "Notificação entregue.");
  });
});
