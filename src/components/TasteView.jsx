import { Download, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { t } from "@/i18n";
import { formatDate } from "@/lib/zimmer-utils";
import { featureLabel, topFeatures, votesExport } from "@/lib/fit";

function download(name, body) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Bar({ w }) {
  const pct = Math.min(100, (Math.abs(w) / 2) * 100);
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${w > 0 ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FeatureList({ items, title, Icon, tone }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className={`mb-3 flex items-center gap-2 font-bold ${tone}`}>
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((f) => (
          <li key={f.feature} data-testid="taste-feature" className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-stone-800">{featureLabel(f.feature)}</span>
            <span className="flex items-center gap-2 text-xs text-stone-500">
              {f.liked_total != null &&
                t("liked {a}/{b}, disliked {c}/{d}", { a: f.liked_with, b: f.liked_total, c: f.unliked_with, d: f.unliked_total })}
              <Bar w={f.weight} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TasteView({ prefs, votes, tripId }) {
  const all = prefs?.profiles?.["*"];
  const feats = topFeatures(all);
  const explicit = Array.isArray(prefs?.explicit) ? prefs.explicit : [];
  const num = all?.numeric || {};
  return (
    <div data-testid="taste-view" className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="rounded-2xl border border-orange-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-stone-900">
          <Sparkles className="h-5 w-5 text-orange-600" /> {t("Your taste")}
        </h2>
        {prefs ? (
          <p className="mt-1 text-sm text-stone-600">
            {t("Learned from {votes} votes on {trips} past trips by {voters}. Updated {date}.", {
              votes: all?.votes ?? 0,
              trips: (prefs.trips || []).length,
              voters: (prefs.voters || []).join(", ") || "-",
              date: formatDate(String(prefs.updated_at || "").slice(0, 10)),
            })}
          </p>
        ) : (
          <p className="mt-1 text-sm text-stone-600">
            {t("No taste profile yet. Vote on places, export the votes and ask your agent to run zf.py learn.")}
          </p>
        )}
      </div>
      <FeatureList items={feats.filter((f) => f.weight > 0)} title={t("You tend to like")} Icon={ThumbsUp} tone="text-emerald-700" />
      <FeatureList items={feats.filter((f) => f.weight < 0)} title={t("You tend to avoid")} Icon={ThumbsDown} tone="text-rose-700" />
      {(explicit.length > 0 || num.drive_minutes || num.price_per_night) && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
          <h3 className="mb-2 font-bold text-stone-800">{t("Notes and limits")}</h3>
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {explicit.map((e, i) => (
              <li key={i}>{e.note || featureLabel(e.feature)}</li>
            ))}
            {num.drive_minutes?.liked_max != null && <li>{t("Liked places up to {n} min drive", { n: num.drive_minutes.liked_max })}</li>}
            {num.price_per_night?.liked_max != null && (
              <li>{t("Liked places up to {n} per night", { n: num.price_per_night.liked_max })}</li>
            )}
          </ul>
        </div>
      )}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 font-bold text-stone-800">{t("Teach it this trip")}</h3>
        <p className="mb-3 text-sm text-stone-600">
          {t(
            "Download this trip's votes and give the file to your agent (zf.py learn --votes votes.json). Next search starts from what you liked.",
          )}
        </p>
        <button
          data-testid="export-votes"
          onClick={() => download("votes.json", votesExport(votes, tripId))}
          className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Download className="h-4 w-4" /> {t("Export votes")} ({(votes || []).length})
        </button>
      </div>
    </div>
  );
}
