import config from "@/config";

// Data adapters: each returns a Promise of zimmer records (see schema/zimmer.schema.json).
// Pick one with storage.data.adapter in trip.config.json.

const resolveUrl = (url) => (/^[a-z]+:\/\//i.test(url) ? url : `${import.meta.env.BASE_URL}${url.replace(/^\.?\//, "")}`);

export async function loadJson(opts = {}, fetchImpl = fetch) {
  const url = resolveUrl(opts.url || "data/zimmers.json");
  const res = await fetchImpl(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : Array.isArray(body?.zimmers) ? body.zimmers : [];
  // relative image paths (written by scripts/zf.py images) are resolved against the app base
  return list.map((z) => ({
    ...z,
    image_urls: (z.image_urls || []).map((u) => (typeof u === "string" && !/^[a-z]+:\/\//i.test(u) ? resolveUrl(u) : u)),
    thumb_urls: (z.thumb_urls || []).map((u) => (typeof u === "string" && !/^[a-z]+:\/\//i.test(u) ? resolveUrl(u) : u)),
  }));
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

export function loadZimmers(cfg = config.storage.data) {
  const fn = DATA_ADAPTERS[cfg?.adapter || "json"];
  if (!fn) return Promise.reject(new Error(`Unknown data adapter "${cfg.adapter}"`));
  return fn(cfg);
}
