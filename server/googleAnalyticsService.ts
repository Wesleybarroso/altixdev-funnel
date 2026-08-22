import { google } from "googleapis";
import { decryptWebhookValue } from "./webhookService";

export type GoogleAnalyticsConfig = { serviceAccountJson: string; propertyId: string; measurementId?: string | null };

function parseGoogleAnalyticsConfig(ciphertext: string): GoogleAnalyticsConfig {
  const config = JSON.parse(decryptWebhookValue(ciphertext)) as GoogleAnalyticsConfig;
  return validateGoogleAnalyticsConfig(config);
}

function parseNumber(value: string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function validateGoogleAnalyticsConfig(config: GoogleAnalyticsConfig) {
  const propertyId = String(config.propertyId ?? "").trim().replace(/^properties\//, "");
  const measurementId = String(config.measurementId ?? "").trim().toUpperCase();
  if (!/^\d{4,30}$/.test(propertyId)) throw new Error("Informe um ID numérico válido da propriedade GA4.");
  if (measurementId && !/^G-[A-Z0-9]{6,16}$/.test(measurementId)) throw new Error("Informe um ID de medição GA4 válido, no formato G-XXXXXXXX.");
  try {
    const credentials = JSON.parse(config.serviceAccountJson) as { client_email?: string; private_key?: string; type?: string };
    if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) throw new Error();
  } catch {
    throw new Error("A credencial GA4 deve ser um JSON válido de conta de serviço.");
  }
  return { serviceAccountJson: config.serviceAccountJson.trim(), propertyId, measurementId: measurementId || null };
}

async function getAnalyticsClient(config: GoogleAnalyticsConfig) {
  const credentials = JSON.parse(config.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  return google.analyticsdata({ version: "v1beta", auth });
}

async function runSummaryReport(config: GoogleAnalyticsConfig) {
  const analytics = await getAnalyticsClient(config);
  return analytics.properties.runReport({
    property: `properties/${config.propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }],
    },
  });
}

export async function testGoogleAnalytics(ciphertext: string) {
  const config = parseGoogleAnalyticsConfig(ciphertext);
  const response = await runSummaryReport(config);
  return { ok: Boolean(response.data), propertyId: config.propertyId };
}

export async function getGoogleAnalyticsOverview(ciphertext: string) {
  const config = parseGoogleAnalyticsConfig(ciphertext);
  const analytics = await getAnalyticsClient(config);
  const [summary, traffic, pages] = await Promise.all([
    runSummaryReport(config),
    analytics.properties.runReport({
      property: `properties/${config.propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: "6",
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    }),
    analytics.properties.runReport({
      property: `properties/${config.propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
        limit: "6",
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      },
    }),
  ]);
  const metrics = summary.data.rows?.[0]?.metricValues ?? [];
  return {
    period: "Últimos 30 dias",
    propertyId: config.propertyId,
    summary: {
      activeUsers: parseNumber(metrics[0]?.value),
      newUsers: parseNumber(metrics[1]?.value),
      sessions: parseNumber(metrics[2]?.value),
      pageViews: parseNumber(metrics[3]?.value),
      engagementRate: parseNumber(metrics[4]?.value),
    },
    channels: (traffic.data.rows ?? []).map(row => ({ channel: row.dimensionValues?.[0]?.value ?? "Não atribuído", sessions: parseNumber(row.metricValues?.[0]?.value), users: parseNumber(row.metricValues?.[1]?.value) })),
    pages: (pages.data.rows ?? []).map(row => ({ path: row.dimensionValues?.[0]?.value ?? "/", pageViews: parseNumber(row.metricValues?.[0]?.value), users: parseNumber(row.metricValues?.[1]?.value) })),
  };
}
