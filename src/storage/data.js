import config from "@/config";

// Data adapters: each returns a Promise of zimmer records (see schema/zimmer.schema.json).
// Pick one with storage.data.adapter in trip.config.json.

const ABS = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i; // http:, https:, data:, blob:, //host
const resolveUrl = (url) => (ABS.test(url) ? url : `${import.meta.env.BASE_URL}${url.replace(/^\.?\//, "")}`);

// Accepts an array of records or { zimmers: [...] }. Returns { records, errors } after a light check
// (the full JSON Schema check is scripts/zf.py validate). Records without slug+name are dropped.
export function validateRecords(body) {
  const list = Array.isArray(body) ? body : Array.isArray(body?.zimmers) ? body.zimmers : null;
  if (!list) return { records: [], errors: ['Expected a JSON array of places (or { "zimmers": [...] })'] };
  const errors = [];
  const seen = new Set();
  const records = [];
  list.forEach((z, i) => {
    if (!z || typeof z !== "object" || Array.isArray(z)) return errors.push(`#${i + 1}: not an object`);
    if (typeof z.name !== "string" || !z.name.trim()) return errors.push(`#${i + 1}: missing "name"`);
    let slug = typeof z.slug === "string" && z.slug.trim() ? z.slug.trim() : null;
    if (!slug) {
      slug =
        z.name
          .toLowerCase()
          .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
          .replace(/^-+|-+$/g, "") || `place-${i + 1}`;
    }
    while (seen.has(slug)) slug += "-2";
    seen.add(slug);
    const arr = (v) => (Array.isArray(v) ? v.filter((u) => typeof u === "string" || u === null) : typeof v === "string" ? [v] : []);
    records.push({ ...z, slug, image_urls: arr(z.image_urls), thumb_urls: arr(z.thumb_urls) });
  });
  if (list.length && !records.length) errors.unshift("No valid places found");
  return { records, errors };
}

// Relative image paths are resolved against `base` (the app, or the URL the JSON came from).
export function resolveImages(records, resolve) {
  const fix = (u) => (typeof u === "string" && u && !ABS.test(u) ? resolve(u) : u);
  return records.map((z) => ({ ...z, image_urls: (z.image_urls || []).map(fix), thumb_urls: (z.thumb_urls || []).map(fix) }));
}

export async function loadJson(opts = {}, fetchImpl = fetch) {
  const url = resolveUrl(opts.url || "data/zimmers.json");
  const res = await fetchImpl(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const { records } = validateRecords(await res.json());
  return resolveImages(records, resolveUrl);
}

// GitHub / Gist page links -> raw links that send CORS headers.
export function toRawUrl(input) {
  const url = String(input || "").trim();
  let m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  m = url.match(/^https:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)\/?(?:#.*)?$/i);
  if (m) return `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`;
  return url;
}

// Viewer mode: load records from any URL that allows cross-origin reads (raw GitHub, Gist, S3, ...).
export async function loadFromUrl(input, fetchImpl = fetch) {
  const url = toRawUrl(input);
  if (!/^https?:\/\//i.test(url)) throw new Error("Only http(s) URLs are supported");
  const res = await fetchImpl(url, {
    mode: "cors",
    credentials: "omit",
    cache: "no-cache",
    headers: { Accept: "application/json, text/plain" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const { records, errors } = parseRecords(text);
  if (!records.length) throw new Error(errors[0] || "No places in this file");
  // Paths written by zf.py are repo-relative ("data/images/..."): resolve them against the folder that
  // contains data/, so a raw GitHub link to data/zimmers.json finds the photos next to it.
  const root = /\/data\/[^/]+$/.test(new URL(url).pathname) ? url.replace(/\/data\/[^/?#]+(?:[?#].*)?$/, "/") : url;
  return { records: resolveImages(records, (u) => new URL(u, /^data\//.test(u) ? root : url).href), errors, source: url };
}

export function parseRecords(text) {
  let body;
  try {
    // tolerate a pasted ```json fence from a chat answer
    body = JSON.parse(
      String(text)
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, ""),
    );
  } catch (e) {
    return { records: [], errors: [`Invalid JSON: ${e.message}`] };
  }
  return validateRecords(body);
}

// Data baked into the single-file bundle (npm run bundle): <script id="zimmer-data" type="application/json">
export function embeddedRecords(doc = globalThis.document) {
  const el = doc && doc.getElementById("zimmer-data");
  if (!el) return null;
  const { records } = parseRecords(el.textContent || "[]");
  return records;
}

// Data the user loaded in the browser (file / paste / URL) is kept so a refresh shows it again.
const CUSTOM_KEY = "zimmer_custom_data";
export function saveCustom(records, source, storage = globalThis.localStorage) {
  try {
    storage.setItem(CUSTOM_KEY, JSON.stringify({ source, records }));
    return true;
  } catch {
    return false; // too big for localStorage: still shown for this visit
  }
}
export function readCustom(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(CUSTOM_KEY) || "null");
    return v && Array.isArray(v.records) ? v : null;
  } catch {
    return null;
  }
}
export function clearCustom(storage = globalThis.localStorage) {
  try {
    storage.removeItem(CUSTOM_KEY);
  } catch {}
}

// Optional: read from a Base44 app's "Zimmer" entity (public read). The SDK is loaded from a CDN at runtime,
// so the default build has no Base44 dependency. Configure: { "adapter": "base44", "app_id": "<your app id>" }.
export async function loadBase44(opts = {}) {
  if (!opts.app_id) throw new Error("storage.data.app_id is required for the base44 adapter");
  const { createClient } = await import(/* @vite-ignore */ opts.sdk_url || "https://esm.sh/@base44/sdk@0.8");
  const client = createClient({ appId: opts.app_id, requiresAuth: false });
  const list = await client.entities[opts.entity || "Zimmer"].list("score", 5000);
  return Array.isArray(list) ? list : [];
}

export const DATA_ADAPTERS = { json: loadJson, base44: loadBase44 };

// Order: ?data=<url>  >  data embedded in a single-file bundle  >  data the user loaded  >  configured adapter.
// Resolves to { records, source } where source is "url" | "embedded" | "custom" | "default".
export async function loadAll(cfg = config.storage.data, loc = globalThis.location) {
  const param = loc && new URLSearchParams(loc.search).get("data");
  if (param) {
    const r = await loadFromUrl(param);
    return { records: r.records, source: "url", label: r.source };
  }
  const embedded = embeddedRecords();
  if (embedded) return { records: embedded, source: "embedded" };
  const custom = readCustom();
  if (custom) return { records: custom.records, source: "custom", label: custom.source };
  return { records: await loadZimmers(cfg), source: "default" };
}

export function loadZimmers(cfg = config.storage.data) {
  const fn = DATA_ADAPTERS[cfg?.adapter || "json"];
  if (!fn) return Promise.reject(new Error(`Unknown data adapter "${cfg.adapter}"`));
  return fn(cfg);
}
