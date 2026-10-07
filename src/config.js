import raw from "../trip.config.json";

// Trip settings shared by the app and the agent scripts (trip.config.json at the repo root).
const DEFAULTS = {
  app: { title: "Zimmer Finder", subtitle: "", locale: "en", currency: "ILS" },
  trip: { check_in: null, check_out: null, adults: 2, children: 0 },
  budget: { max_total: null },
  origin: { name: "", lat: null, lng: null },
  region: { country: "", phone_country_code: "", mobile_prefixes: [], map_center: [0, 0], map_zoom: 2 },
  storage: { data: { adapter: "json", url: "data/zimmers.json" }, votes: { adapter: "local" } },
};

const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  }
  return out;
};

// Build-time overrides (e.g. from GitHub Actions variables) so keys don't have to live in the repo.
const env = import.meta.env || {};
const fromEnv = {};
if (env.VITE_VOTES_ADAPTER) {
  fromEnv.storage = {
    votes: {
      adapter: env.VITE_VOTES_ADAPTER,
      ...(env.VITE_SUPABASE_URL && { url: env.VITE_SUPABASE_URL }),
      ...(env.VITE_SUPABASE_ANON_KEY && { anon_key: env.VITE_SUPABASE_ANON_KEY }),
      ...(env.VITE_VOTES_TRIP_ID && { trip_id: env.VITE_VOTES_TRIP_ID }),
    },
  };
}

export const config = merge(merge(DEFAULTS, raw), fromEnv);

export const nightsOf = (ci, co) => {
  const a = Date.parse(ci),
    b = Date.parse(co);
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((b - a) / 86400000);
};

export const NIGHTS = nightsOf(config.trip.check_in, config.trip.check_out);
export default config;
