import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, emailPlaceholders, getSiteCopy, localeOptions, privateAccessLabels, SITE_CONTACT_EMAIL } from "./siteI18n";

describe("catálogo de idiomas da landing Altixdev", () => {
  it("expõe português do Brasil como padrão e o e-mail público correto", () => {
    expect(DEFAULT_LOCALE).toBe("pt-BR");
    expect(SITE_CONTACT_EMAIL).toBe("contato@altixdev.com.br");
  });

  it("mantém os dez idiomas solicitados com conteúdo de diagnóstico e rodapé", () => {
    expect(localeOptions.map(option => option.code)).toEqual(["pt-BR", "en-US", "es", "pt-PT", "de", "nl", "en-GB", "ru", "nb", "ga"]);

    localeOptions.forEach(option => {
      const copy = getSiteCopy(option.code);
      expect(copy.hero.title.length).toBeGreaterThan(0);
      expect(copy.diagnostic.questionSteps).toHaveLength(4);
      expect(copy.diagnostic.questionSteps.every(question => question.options.length >= 4)).toBe(true);
      expect(copy.footerTagline).not.toEqual("");
      expect(privateAccessLabels[option.code]).not.toEqual("");
      expect(emailPlaceholders[option.code]).toContain("@");
    });
  });

  it("fornece os textos visíveis da landing em inglês sem recorrer ao português", () => {
    const english = getSiteCopy("en-US");

    expect(english.nav.start).toBe("Start diagnostic");
    expect(english.hero.primaryCta).toBe("Get my free diagnostic");
    expect(english.diagnostic.fields.email).toBe("Email");
    expect(english.diagnostic.submit).toBe("View summary and talk on WhatsApp");
    expect(privateAccessLabels["en-US"]).toBe("Private access");
    expect(emailPlaceholders["en-US"]).toBe("email@company.com");
  });
});
