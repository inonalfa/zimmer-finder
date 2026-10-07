import { describe, expect, it } from "vitest";
import { t, plural, locale, dir } from "./index";
import he from "./he";

describe("i18n", () => {
  it("defaults to the config locale (en, ltr) and interpolates", () => {
    expect(locale).toBe("en");
    expect(dir).toBe("ltr");
    expect(t("{n} of {total} results", { n: 2, total: 5 })).toBe("2 of 5 results");
    expect(plural(1, "{n} photo", "{n} photos")).toBe("1 photo");
    expect(t("Unknown key stays")).toBe("Unknown key stays");
  });
  it("Hebrew keeps every placeholder of the English key", () => {
    for (const [k, v] of Object.entries(he)) {
      const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      if (ph(v)) expect(ph(v), k).toBe(ph(k));
    }
  });
  it("uses only ASCII hyphens in translations", () => {
    for (const v of Object.values(he)) expect(v).not.toMatch(/[\u2013\u2014]/);
  });
});
