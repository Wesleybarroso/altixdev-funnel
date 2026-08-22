import { describe, expect, it } from "vitest";
import { validateGoogleAnalyticsConfig } from "./googleAnalyticsService";

const serviceAccountJson = JSON.stringify({
  type: "service_account",
  client_email: "analytics-reader@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST_ONLY\n-----END PRIVATE KEY-----\n",
});

describe("Google Analytics 4 configuration", () => {
  it("normaliza o prefixo da propriedade GA4", () => {
    expect(validateGoogleAnalyticsConfig({ serviceAccountJson, propertyId: "properties/123456789", measurementId: "g-ab12cd34" })).toEqual({ serviceAccountJson, propertyId: "123456789", measurementId: "G-AB12CD34" });
  });

  it("recusa uma propriedade não numérica e JSON sem chave privada", () => {
    expect(() => validateGoogleAnalyticsConfig({ serviceAccountJson, propertyId: "minha-propriedade" })).toThrow("ID numérico válido");
    expect(() => validateGoogleAnalyticsConfig({ serviceAccountJson, propertyId: "123456789", measurementId: "measurement-id" })).toThrow("ID de medição GA4 válido");
    expect(() => validateGoogleAnalyticsConfig({ serviceAccountJson: JSON.stringify({ type: "service_account", client_email: "reader@example.com" }), propertyId: "123456789" })).toThrow("JSON válido de conta de serviço");
  });
});
