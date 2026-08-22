import { getIntegrationConfigByProvider, recordIntegrationCheck } from "./db";
import { decryptWebhookValue, validateWebhookUrl } from "./webhookService";

type NtfyConfig = { serverUrl: string; topic: string; token?: string | null };
export type NtfyEvent = { title: string; message: string; priority?: "min" | "low" | "default" | "high" | "urgent"; tags?: string[] };

export function composeNtfyEvent(input: { eventType: string; status: "info" | "success" | "warning" | "error"; message: string }): NtfyEvent {
  if (input.status === "error") return { title: "ALTIXDEV | Atencao necessaria", message: input.message, priority: "high", tags: ["warning", "rotating_light"] };
  if (input.eventType === "lead.created") return { title: "ALTIXDEV | Novo lead", message: input.message, priority: "default", tags: ["briefcase", "arrow_up"] };
  if (input.eventType === "lead.updated") return { title: "ALTIXDEV | CRM atualizado", message: input.message, priority: "default", tags: ["memo", "white_check_mark"] };
  if (input.eventType.endsWith(".exported")) return { title: "ALTIXDEV | Exportacao concluida", message: input.message, priority: "default", tags: ["file_folder", "white_check_mark"] };
  if (input.eventType.includes("lead_auto_synced") || input.eventType.includes("lead_synced")) return { title: "ALTIXDEV | Lead sincronizado", message: input.message, priority: "default", tags: ["arrows_counterclockwise", "white_check_mark"] };
  if (input.eventType.endsWith(".tested")) return { title: "ALTIXDEV | Integracao verificada", message: input.message, priority: "default", tags: ["electric_plug", "white_check_mark"] };
  return { title: "ALTIXDEV | Atualizacao do painel", message: input.message, priority: input.status === "warning" ? "low" : "default", tags: ["bell", "altixdev"] };
}

function parseConfig(ciphertext: string): NtfyConfig {
  const parsed = JSON.parse(decryptWebhookValue(ciphertext)) as NtfyConfig;
  if (!parsed.serverUrl || !parsed.topic) throw new Error("Configuração ntfy inválida.");
  return parsed;
}

export async function sendNtfyNotification(event: NtfyEvent) {
  const configRecord = await getIntegrationConfigByProvider("ntfy");
  if (!configRecord?.enabled) return { skipped: true, ok: true, status: null as number | null };

  try {
    const config = parseConfig(configRecord.configCiphertext);
    const serverUrl = config.serverUrl.replace(/\/$/, "");
    const topic = config.topic.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic)) throw new Error("Tópico ntfy inválido.");
    const target = validateWebhookUrl(`${serverUrl}/${topic}`);
    const headers: Record<string, string> = {
      "content-type": "text/plain; charset=utf-8",
      "title": event.title,
      "priority": event.priority ?? "default",
      "tags": (event.tags ?? ["bell", "altixdev"]).join(","),
    };
    if (config.token) headers.authorization = `Bearer ${config.token}`;
    const response = await fetch(target, { method: "POST", headers, body: event.message });
    await recordIntegrationCheck("ntfy", response.status, response.ok ? "Notificação entregue." : "ntfy respondeu com erro.");
    return { skipped: false, ok: response.ok, status: response.status };
  } catch {
    await recordIntegrationCheck("ntfy", null, "Não foi possível entregar a notificação ntfy.");
    return { skipped: false, ok: false, status: null as number | null };
  }
}

export function validateNtfyConfig(config: NtfyConfig) {
  const topic = config.topic.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic)) throw new Error("O tópico ntfy deve conter apenas letras, números, hífen ou sublinhado.");
  const target = validateWebhookUrl(`${config.serverUrl.replace(/\/$/, "")}/${topic}`);
  const url = new URL(target);
  return { serverUrl: url.origin, topic, token: config.token?.trim() || null };
}
