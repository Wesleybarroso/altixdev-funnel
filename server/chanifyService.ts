import { getIntegrationConfigByProvider, recordIntegrationCheck } from "./db";
import type { NtfyEvent } from "./ntfyService";
import { decryptWebhookValue } from "./webhookService";

type ChanifyConfig = { token: string };

function parseConfig(ciphertext: string): ChanifyConfig {
  const parsed = JSON.parse(decryptWebhookValue(ciphertext)) as ChanifyConfig;
  return validateChanifyConfig(parsed);
}

export function validateChanifyConfig(config: ChanifyConfig) {
  const token = config.token.trim();
  if (token.length < 8 || token.length > 512) throw new Error("Informe um token Chanify válido.");
  return { token };
}

export async function sendChanifyNotification(event: NtfyEvent) {
  const configRecord = await getIntegrationConfigByProvider("chanify");
  if (!configRecord?.enabled) return { skipped: true, ok: true, status: null as number | null };

  try {
    const config = parseConfig(configRecord.configCiphertext);
    const target = `https://api.chanify.net/v1/sender/${encodeURIComponent(config.token)}`;
    const body = new URLSearchParams({ text: `${event.title}\n${event.message}` });
    const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" }, body });
    await recordIntegrationCheck("chanify", response.status, response.ok ? "Notificação Chanify entregue." : "Chanify respondeu com erro.");
    return { skipped: false, ok: response.ok, status: response.status };
  } catch {
    await recordIntegrationCheck("chanify", null, "Não foi possível entregar a notificação Chanify.");
    return { skipped: false, ok: false, status: null as number | null };
  }
}
