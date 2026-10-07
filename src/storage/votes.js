import config from "@/config";

// Vote stores. A vote is { zimmer_slug, voter_name, vote: "like" | "unlike", updated_at }.
// Every store implements: list() -> Promise<vote[]> (newest first) and cast(slug, name, vote | null).
// Pick one with storage.votes.adapter in trip.config.json.

const now = () => new Date().toISOString();
const newestFirst = (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""));

// Default: votes live in this browser only. Great for one device (e.g. a shared tablet); no setup at all.
export function localStore(opts = {}, storage = globalThis.localStorage) {
  const key = `zimmer_votes:${opts.trip_id || "default"}`;
  const read = () => {
    try {
      const v = JSON.parse(storage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  return {
    kind: "local",
    shared: false,
    async list() {
      return read().sort(newestFirst);
    },
    async cast(slug, name, vote) {
      const rest = read().filter((v) => !(v.zimmer_slug === slug && v.voter_name === name));
      if (vote) rest.push({ zimmer_slug: slug, voter_name: name, vote, updated_at: now() });
      storage.setItem(key, JSON.stringify(rest));
      return { ok: true };
    },
  };
}

// Shared votes on a free Supabase project (see docs/votes-supabase.md for the one-time SQL).
// { "adapter": "supabase", "url": "https://xyz.supabase.co", "anon_key": "...", "trip_id": "our-trip-2027" }
export function supabaseStore(opts = {}, fetchImpl = (...a) => fetch(...a)) {
  if (!opts.url || !opts.anon_key) throw new Error("storage.votes.url and storage.votes.anon_key are required for supabase");
  const base = `${opts.url.replace(/\/$/, "")}/rest/v1/${opts.table || "zimmer_votes"}`;
  const trip = opts.trip_id || "default";
  const headers = { apikey: opts.anon_key, Authorization: `Bearer ${opts.anon_key}`, "Content-Type": "application/json" };
  const check = async (res) => {
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
    return res;
  };
  return {
    kind: "supabase",
    shared: true,
    async list() {
      const q = `?trip_id=eq.${encodeURIComponent(trip)}&select=zimmer_slug,voter_name,vote,updated_at&order=updated_at.desc&limit=5000`;
      const res = await check(await fetchImpl(base + q, { headers }));
      return res.json();
    },
    async cast(slug, name, vote) {
      if (!vote) {
        const q = `?trip_id=eq.${encodeURIComponent(trip)}&zimmer_slug=eq.${encodeURIComponent(slug)}&voter_name=eq.${encodeURIComponent(name)}`;
        await check(await fetchImpl(base + q, { method: "DELETE", headers }));
        return { ok: true };
      }
      await check(
        await fetchImpl(`${base}?on_conflict=trip_id,zimmer_slug,voter_name`, {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ trip_id: trip, zimmer_slug: slug, voter_name: name, vote, updated_at: now() }),
        }),
      );
      return { ok: true };
    },
  };
}

// Optional: Base44 "ZimmerVote" entity + "zimmer-vote" backend function (see docs/storage.md).
export function base44Store(opts = {}) {
  if (!opts.app_id) throw new Error("storage.votes.app_id is required for the base44 adapter");
  let client;
  const get = async () => {
    if (!client) {
      const { createClient } = await import(/* @vite-ignore */ opts.sdk_url || "https://esm.sh/@base44/sdk@0.8");
      client = createClient({ appId: opts.app_id, requiresAuth: false });
    }
    return client;
  };
  return {
    kind: "base44",
    shared: true,
    async list() {
      const c = await get();
      const data = await c.entities.ZimmerVote.list("-updated_date", 5000);
      return (Array.isArray(data) ? data : []).map((v) => ({ ...v, updated_at: v.updated_at || v.updated_date }));
    },
    async cast(slug, name, vote) {
      const c = await get();
      const res = await c.functions.invoke("zimmer-vote", { zimmer_slug: slug, voter_name: name, vote: vote || "clear" });
      const d = res && res.data !== undefined ? res.data : res;
      if (d && d.ok === false) throw new Error(d.error || "vote failed");
      return { ok: true };
    },
  };
}

export const VOTE_STORES = { local: localStore, supabase: supabaseStore, base44: base44Store };

export function createVoteStore(cfg = config.storage.votes) {
  const make = VOTE_STORES[cfg?.adapter || "local"];
  if (!make) throw new Error(`Unknown votes adapter "${cfg.adapter}"`);
  return make(cfg);
}
