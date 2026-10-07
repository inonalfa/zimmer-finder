import { t } from "@/i18n";

// Personal fit (written by `zf.py rank` from data/preferences.json): fit_score 0-100 + structured fit_reasons.
export const hasFit = (z) => typeof z?.fit_score === "number";

export function featureLabel(f) {
  if (f.startsWith("region:")) return t("{region} area", { region: f.slice(7) });
  const L = {
    jacuzzi_indoor: t("Indoor jacuzzi"),
    jacuzzi_outdoor: t("Outdoor jacuzzi"),
    both_jacuzzi: t("Indoor + outdoor jacuzzi"),
    view: t("A view"),
    pool: t("Pool"),
    kitchen: t("Kitchen"),
    bbq: t("BBQ"),
    breakfast: t("Breakfast"),
    detached: t("Detached unit"),
    near_host: t("Next to the hosts' house"),
    high_rating: t("High rating"),
    red_flags: t("Review red flags"),
    long_drive: t("Long drive"),
    drive_over: t("Longer drive than you usually pick"),
    price_over: t("Pricier than you usually pick"),
  };
  return L[f] || f;
}

// One short sentence per reason, e.g. "Detached unit - you liked 4 of 4 places with it".
export function reasonText(r) {
  const label = featureLabel(r.feature);
  if (r.note) return `${label} - ${r.note}`;
  if (r.liked_total != null && r.liked_with != null) {
    const ev =
      r.kind === "match"
        ? t("you liked {a} of {b} places with it", { a: r.liked_with, b: r.liked_total })
        : r.kind === "warn"
          ? t("{a} of {b} places you disliked had it", { a: r.unliked_with ?? 0, b: r.unliked_total ?? 0 })
          : t("missing - you liked {a} of {b} places with it", { a: r.liked_with, b: r.liked_total });
    return `${label} - ${ev}`;
  }
  return label;
}

export const fitTone = (s) => (s >= 75 ? "bg-emerald-600 text-white" : s >= 50 ? "bg-amber-500 text-white" : "bg-stone-500 text-white");

// Votes as a JSON file for `zf.py learn --votes <file>`.
export function votesExport(votes, tripId) {
  const rows = (votes || [])
    .filter((v) => v && v.zimmer_slug && v.voter_name && (v.vote === "like" || v.vote === "unlike"))
    .map(({ zimmer_slug, voter_name, vote, updated_at }) => ({ zimmer_slug, voter_name, vote, ...(updated_at ? { updated_at } : {}) }));
  return { trip_id: tripId || "default", exported_at: new Date().toISOString(), votes: rows };
}

// Weighted features of one profile, strongest first.
export function topFeatures(profile, min = 0.15) {
  const f = profile?.features || {};
  return Object.entries(f)
    .filter(([, v]) => Math.abs(v.weight) >= min)
    .sort((a, b) => Math.abs(b[1].weight) - Math.abs(a[1].weight))
    .map(([k, v]) => ({ feature: k, ...v }));
}
