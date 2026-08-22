import { getIntegrationConfigByProvider, recordIntegrationCheck } from "./db";
import type { NtfyEvent } from "./ntfyService";
import { decryptWebhookValue, validateWebhookUrl } from "./webhookService";

type ChanifyConfig = { token: string; serverUrl?: string };

function parseConfig(ciphertext: string): ChanifyConfig {
  const parsed = JSON.parse(decryptWebhookValue(ciphertext)) as ChanifyConfig;
  return validateChanifyConfig(parsed);
}

export function validateChanifyConfig(config: ChanifyConfig) {
  const token = config.token.trim();
  if (token.length < 8 || token.length > 512) throw new Error("Informe um token Chanify válido.");
  let serverUrl: string;
  try {
    serverUrl = validateWebhookUrl(config.serverUrl?.trim() || "https://api.chanify.net").replace(/\/$/, "");
  } catch {
    throw new Error("Informe uma URL HTTPS pública válida para o servidor Chanify.");
  }
  return { token, serverUrl };
}

export async function sendChanifyNotification(event: NtfyEvent) {
  const configRecord = await getIntegrationConfigByProvider("chanify");
  if (!configRecord?.enabled) return { skipped: true, ok: true, status: null as number | null };

  try {
    const config = parseConfig(configRecord.configCiphertext);
    const target = `${config.serverUrl}/v1/sender/${encodeURIComponent(config.token)}`;
    const body = new URLSearchParams({ text: `${event.title}\n${event.message}` });
    const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" }, body });
    await recordIntegrationCheck("chanify", response.status, response.ok ? "Notificação Chanify entregue." : "Chanify respondeu com erro.");
    return { skipped: false, ok: response.ok, status: response.status };
  } catch {
    await recordIntegrationCheck("chanify", null, "Não foi possível entregar a notificação Chanify.");
    return { skipped: false, ok: false, status: null as number | null };
  }
}
