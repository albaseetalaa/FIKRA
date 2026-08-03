import { describe, expect, it } from "vitest";
import { isValidCurrencyCode, normalizeCurrencyCode, listSupportedCurrencyCodes } from "./currencyCatalog";

describe("currencyCatalog", () => {
  describe("isValidCurrencyCode", () => {
    it.each(["JOD", "SAR", "USD", "AED", "GBP"])("accepts real ISO-4217 code %s", (code) => {
      expect(isValidCurrencyCode(code)).toBe(true);
    });

    it.each(["AAA", "XYZ", "ZZZ", "JDO"])("rejects non-currency 3-letter string %s", (code) => {
      expect(isValidCurrencyCode(code)).toBe(false);
    });

    it("accepts lowercase input by normalizing before validating", () => {
      expect(isValidCurrencyCode("jod")).toBe(true);
    });

    it("rejects non-3-letter shapes", () => {
      expect(isValidCurrencyCode("JO")).toBe(false);
      expect(isValidCurrencyCode("JODX")).toBe(false);
      expect(isValidCurrencyCode("")).toBe(false);
    });

    it("rejects non-string input", () => {
      expect(isValidCurrencyCode(undefined)).toBe(false);
      expect(isValidCurrencyCode(null)).toBe(false);
      expect(isValidCurrencyCode(123)).toBe(false);
    });

    it("rejects a numeric-looking or symbol-containing string", () => {
      expect(isValidCurrencyCode("J0D")).toBe(false);
      expect(isValidCurrencyCode("J-D")).toBe(false);
    });
  });

  describe("normalizeCurrencyCode", () => {
    it("uppercases and trims", () => {
      expect(normalizeCurrencyCode(" jod ")).toBe("JOD");
    });

    it("returns null for non-string or blank input", () => {
      expect(normalizeCurrencyCode(undefined)).toBeNull();
      expect(normalizeCurrencyCode("   ")).toBeNull();
    });
  });

  describe("listSupportedCurrencyCodes", () => {
    it("includes the currencies FIKRA exposes", () => {
      const list = listSupportedCurrencyCodes();
      for (const code of ["JOD", "SAR", "USD", "AED", "GBP"]) {
        expect(list).toContain(code);
      }
    });

    it("does not include fabricated codes", () => {
      const list = listSupportedCurrencyCodes();
      expect(list).not.toContain("AAA");
      expect(list).not.toContain("JDO");
    });
  });
});
