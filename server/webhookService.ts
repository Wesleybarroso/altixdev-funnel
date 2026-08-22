import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Lead } from "../drizzle/schema";
import { ENV } from "./_core/env";

function getEncryptionKey() {
  if (!ENV.cookieSecret) throw new Error("Segredo de criptografia não configurado.");
  return createHash("sha256").update(`${ENV.cookieSecret}:altixdev-webhooks`).digest();
}

export function encryptWebhookValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(part => part.toString("base64url")).join(".");
}

export function decryptWebhookValue(value: string) {
  const [ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Configuração de webhook inválida.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

export function validateWebhookUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const isPrivateIpv4 = /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
  const isLocal = hostname === "localhost" || hostname.endsWith(".local") || hostname === "::1";
  if (url.protocol !== "https:" || isPrivateIpv4 || isLocal) {
    throw new Error("Use uma URL pública com HTTPS para o webhook.");
  }
  return url.toString();
}

type DeliveryConfig = { url: string; authHeaderName?: string | null; secret?: string | null };

export async function postWebhook(config: DeliveryConfig, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Altixdev-Pipeline/1.0" };
    if (config.authHeaderName && config.secret) headers[config.authHeaderName] = config.secret;
    const response = await fetch(config.url, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

export function createWebhookTestPayload(name: string) {
  return {
    event: "altixdev.webhook.test",
    sentAt: new Date().toISOString(),
    source: "altixdev-pipeline",
    webhookName: name,
    message: "Teste de conexão disparado manualmente pelo painel Altixdev.",
  };
}

export function createLeadWebhookPayload(lead: Lead) {
  return {
    event: "altixdev.lead.exported",
    sentAt: new Date().toISOString(),
    source: "altixdev-pipeline",
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      stage: lead.stage,
      priority: lead.priority,
      source: lead.source,
      objective: lead.objective,
      currentChannel: lead.currentChannel,
      bottleneck: lead.bottleneck,
      urgency: lead.urgency,
      diagnosticSummary: lead.diagnosticSummary,
      notes: lead.notes,
      nextStep: lead.nextStep,
      consent: lead.consent,
      consentAt: lead.consentAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
    crm: {
      contact_name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      lifecycle_stage: lead.stage,
      lead_priority: lead.priority,
      lead_source: lead.source,
      diagnostic_summary: lead.diagnosticSummary,
    },
  };
}
