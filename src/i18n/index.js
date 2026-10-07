import he from "./he.js";
import config from "@/config";

// Messages are written in English in the source; other locales map English -> translation.
// Placeholders use {name}. Unknown keys fall back to English, so a missing translation never breaks the UI.
const DICTS = { en: {}, he };
const RTL = new Set(["he", "ar", "fa", "ur"]);

const fromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get("lang");
  } catch {
    return null;
  }
};

export const locale = (() => {
  const l = (fromUrl() || config.app.locale || "en").toLowerCase().split("-")[0];
  return DICTS[l] ? l : "en";
})();
export const dir = RTL.has(locale) ? "rtl" : "ltr";
export const isRtl = dir === "rtl";

export function t(msg, vars) {
  const s = (DICTS[locale] && DICTS[locale][msg]) || msg;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : s;
}

// Plural helper: plural(n, "{n} photo", "{n} photos")
export const plural = (n, one, many) => t(n === 1 ? one : many, { n });

export const collator = new Intl.Collator(locale);

// Config text can be a plain string or a per-language object: { "en": "Zimmer Finder", "he": "מחפש הצימרים" }
export const localized = (v) => (v && typeof v === "object" ? v[locale] || v.en || Object.values(v)[0] || "" : v || "");
