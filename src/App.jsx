import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { loadAll, saveCustom, clearCustom, loadPreferences } from "@/storage/data";
import TasteView from "@/components/TasteView";
import { hasFit } from "@/lib/fit";
import LoadDataDialog from "@/components/LoadDataDialog";
import {
  CalendarDays,
  SlidersHorizontal,
  RotateCcw,
  Home,
  Heart,
  UserRound,
  Pencil,
  X,
  LayoutGrid,
  Images,
  EyeOff,
  Map as MapIcon,
  ChevronDown,
  Upload,
  Sparkles,
} from "lucide-react";
import ZimmerCard from "@/components/ZimmerCard";
import ZimmerDetail from "@/components/ZimmerDetail";
import NameDialog from "@/components/NameDialog";
import GalleryView from "@/components/GalleryView";
import ImmersiveViewer from "@/components/ImmersiveViewer";
const MapView = lazy(() => import("@/components/MapView"));
import { useVotes, isUnliked, isMatch } from "@/lib/votes";
import {
  formatDate,
  formatPrice,
  searchDates,
  photosOf,
  finalPrice,
  isSoldOut,
  newBaseline,
  isNewSince,
  formatDrive,
} from "@/lib/zimmer-utils";
import { t, plural, dir, collator, localized } from "@/i18n";
import config from "@/config";

const DEFAULT_VOTE_FILTER = "hide_unliked";
// Views live in the query string (?v=gallery, ?v=map) so the app works from any sub-path, e.g. GitHub Pages.
const params = () => new URLSearchParams(window.location.search);
const viewFromPath = () => {
  const v = params().get("v");
  return v === "gallery" || v === "map" || v === "taste" ? v : "list";
};
const urlFor = (v, extra = {}) => {
  const q = params();
  q.delete("v");
  q.delete("view");
  if (v && v !== "list") q.set("v", v);
  for (const [k, val] of Object.entries(extra)) q.set(k, val);
  const qs = q.toString();
  return window.location.pathname + (qs ? "?" + qs : "");
};
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : Infinity);

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-stone-700">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onChange(!checked)}
        onClick={() => onChange(!checked)}
        className={`relative inline-block h-6 w-11 rounded-full transition-colors ${checked ? "bg-orange-600" : "bg-stone-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "right-0.5" : "right-[22px]"}`}
        />
      </span>
      {label}
    </label>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [prefs, setPrefs] = useState(null); // data/preferences.json (learned taste), optional
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataInfo, setDataInfo] = useState({ source: "default" }); // where the records came from
  const [loadDialog, setLoadDialog] = useState(false);
  const [selected, setSelected] = useState(null);

  const [region, setRegion] = useState("");
  const [maxPrice, setMaxPrice] = useState(null);
  const [bothJacuzzi, setBothJacuzzi] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recommended"); // recommended | fit | drive | price
  const [maxDrive, setMaxDrive] = useState(0); // minutes, 0 = no limit
  const [showSold, setShowSold] = useState(false);
  const [baseline] = useState(newBaseline); // "New" = added after the last visit (first visit: last 3 days)
  const [showFilters, setShowFilters] = useState(false);
  // all | liked_any | liked_me | matches | hide_unliked. Not persisted: every visit starts with "hide unliked".
  const [voteFilter, setVoteFilter] = useState(DEFAULT_VOTE_FILTER);

  // views: list, gallery (?v=gallery), map (?v=map); immersive viewer on top of the gallery (&view=1)
  const [view, setView] = useState(viewFromPath);
  const [viewer, setViewer] = useState(null); // null | { photos, index }
  useEffect(() => {
    if (params().get("view") === "1") history.replaceState(null, "", urlFor(viewFromPath()) + window.location.hash);
    const onPop = () => {
      setView(viewFromPath());
      if (params().get("view") !== "1") setViewer(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goView = (v) => {
    if (v === view) return;
    setViewer(null);
    history.pushState(null, "", urlFor(v));
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const { votes, infoFor, cast, myName, setMyName, myLikedCount, error: voteError, clearError } = useVotes();
  const [nameDialog, setNameDialog] = useState(null); // null | { slug, vote } | { rename: true }

  const voteFor = (slug) => (vote) => {
    if (!slug) return;
    if (!myName) {
      setNameDialog({ slug, vote });
      return;
    }
    cast(slug, vote);
  };
  const saveName = (name) => {
    const pending = nameDialog;
    setMyName(name);
    setNameDialog(null);
    if (pending && pending.slug) cast(pending.slug, pending.vote, name);
  };
  useEffect(() => {
    if (!voteError) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [voteError]);

  useEffect(() => {
    (async () => {
      try {
        const r = await loadAll();
        loadPreferences().then(setPrefs);
        setItems(r.records);
        setDataInfo({ source: r.source, label: r.label });
      } catch (e) {
        const fromUrl = new URLSearchParams(window.location.search).get("data");
        setError(
          fromUrl
            ? t("Could not load the data from {url}: {error}", { url: fromUrl, error: e.message })
            : t("Could not load the places. Try refreshing the page."),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // open detail from URL hash (#slug)
  useEffect(() => {
    if (!items.length) return;
    const slug = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (slug) {
      const z = items.find((i) => i.slug === slug);
      if (z) setSelected(z);
    }
  }, [items]);

  const open = (z) => {
    setSelected(z);
    if (z.slug)
      history.replaceState(history.state, "", window.location.pathname + window.location.search + "#" + encodeURIComponent(z.slug));
  };
  const close = useCallback(() => {
    setSelected(null);
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }, []);

  const regions = useMemo(() => [...new Set(items.map((z) => z.region).filter(Boolean))].sort(collator.compare), [items]);
  const priceCeil = useMemo(() => {
    const prices = items.map(finalPrice).filter((n) => typeof n === "number");
    return prices.length ? Math.ceil(Math.max(...prices) / 100) * 100 : 0;
  }, [items]);
  const priceFloor = useMemo(() => {
    const prices = items.map(finalPrice).filter((n) => typeof n === "number");
    return prices.length ? Math.floor(Math.min(...prices) / 100) * 100 : 0;
  }, [items]);
  const effMax = maxPrice ?? priceCeil;
  const priceFiltering = maxPrice !== null && maxPrice < priceCeil;

  const dates = useMemo(() => searchDates(items), [items]);

  const baseFiltered = useMemo(() => {
    return items
      .filter((z) => !region || z.region === region)
      .filter((z) => !priceFiltering || (typeof finalPrice(z) === "number" && finalPrice(z) <= effMax))
      .filter((z) => !bothJacuzzi || (z.jacuzzi_indoor && z.jacuzzi_outdoor))
      .filter((z) => !verifiedOnly || z.availability_status === "verified")
      .filter((z) => !maxDrive || (typeof z.drive_minutes === "number" && z.drive_minutes <= maxDrive));
  }, [items, region, effMax, priceFiltering, bothJacuzzi, verifiedOnly, maxDrive]);

  // sold out (is_active false / availability unavailable) go to a collapsed section at the bottom
  const soldOut = useMemo(() => baseFiltered.filter(isSoldOut).sort((a, b) => num(a.score) - num(b.score)), [baseFiltered]);

  const hiddenUnliked = useMemo(
    () => (voteFilter === "hide_unliked" ? baseFiltered.filter((z) => !isSoldOut(z) && isUnliked(infoFor(z.slug))).length : 0),
    [voteFilter, baseFiltered, infoFor],
  );

  const filtered = useMemo(() => {
    const key =
      sortBy === "fit"
        ? (z) => -(hasFit(z) ? z.fit_score : -1)
        : sortBy === "drive"
          ? (z) => num(z.drive_minutes)
          : sortBy === "price"
            ? (z) => num(finalPrice(z))
            : () => 0;
    return (
      baseFiltered
        .filter((z) => !isSoldOut(z))
        .filter((z) => {
          if (voteFilter === "all") return true;
          const v = infoFor(z.slug);
          if (voteFilter === "liked_any") return v.likes.length > 0;
          if (voteFilter === "liked_me") return v.mine === "like";
          if (voteFilter === "matches") return isMatch(v);
          if (voteFilter === "hide_unliked") return !isUnliked(v);
          return true;
        })
        .map((z) => ({ z, m: isMatch(infoFor(z.slug)) ? 0 : 1 }))
        // couple matches first, then the chosen sort, then the list score
        .sort((a, b) => a.m - b.m || key(a.z) - key(b.z) || num(a.z.score) - num(b.z.score))
        .map((x) => x.z)
    );
  }, [baseFiltered, voteFilter, infoFor, sortBy]);
  const matchCount = useMemo(() => items.filter((z) => !isSoldOut(z) && isMatch(infoFor(z.slug))).length, [items, infoFor]);
  const mapItems = useMemo(() => [...filtered, ...soldOut], [filtered, soldOut]);

  // gallery: every photo of every filtered zimmer, as one continuous list
  const galleryGroups = useMemo(() => {
    let offset = 0;
    return filtered
      .map((z) => {
        const imgs = photosOf(z);
        const photos = imgs.map(({ src, thumb }, i) => ({ src, thumb, z, i, n: imgs.length }));
        const g = { z, photos, offset };
        offset += photos.length;
        return g;
      })
      .filter((g) => g.photos.length);
  }, [filtered]);
  const openViewer = (index) => {
    const photos = galleryGroups.flatMap((g) => g.photos); // snapshot: votes/filters changing won't reshuffle an open viewer
    if (!photos.length) return;
    history.pushState({ viewer: true }, "", urlFor("gallery", { view: "1" }));
    setViewer({ photos, index });
  };
  const closeViewer = useCallback(() => {
    if (history.state && history.state.viewer) history.back();
    else {
      setViewer(null);
      history.replaceState(null, "", urlFor("gallery"));
    }
  }, []);

  const onLoaded = ({ records, source, label, url }) => {
    setItems(records);
    setDataInfo({ source, label });
    setError(null);
    setSelected(null);
    setLoadDialog(false);
    const q = new URLSearchParams(window.location.search);
    if (source === "url" && url) {
      clearCustom();
      q.set("data", url); // shareable link
    } else {
      q.delete("data");
      saveCustom(records, label);
    }
    const qs = q.toString();
    history.replaceState(history.state, "", window.location.pathname + (qs ? "?" + qs : ""));
  };
  const backToDefault = () => {
    clearCustom();
    const q = new URLSearchParams(window.location.search);
    q.delete("data");
    const qs = q.toString();
    window.location.href = window.location.pathname + (qs ? "?" + qs : "");
  };

  const reset = () => {
    setRegion("");
    setMaxPrice(null);
    setBothJacuzzi(false);
    setVerifiedOnly(false);
    setSortBy("recommended");
    setMaxDrive(0);
    setVoteFilter(DEFAULT_VOTE_FILTER);
  };

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-b from-orange-50/70 via-[#fbf7f1] to-[#f7f1e8]"
      style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <header className="border-b border-orange-100/80 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
                <Home className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{localized(config.app.title)}</h1>
                <p className="text-sm text-stone-500">{localized(config.app.subtitle)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-stone-100 p-1" role="tablist" aria-label={t("Display mode")}>
                {[
                  ["list", t("List"), LayoutGrid],
                  ["gallery", t("Gallery"), Images],
                  ["map", t("Map"), MapIcon],
                  ["taste", t("Your taste"), Sparkles],
                ].map(([v, label, Icon]) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => goView(v)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${view === v ? "bg-white text-orange-700 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
              {dates && (
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-900">
                  <CalendarDays className="w-4 h-4" />
                  {t("Search dates")}: {formatDate(dates.check_in)} - {formatDate(dates.check_out)}
                </span>
              )}
              <button
                onClick={() => setLoadDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-700 hover:border-orange-300"
                title={t("Open results your agent gave you (file, paste or link)")}
              >
                <Upload className="h-4 w-4 text-orange-600" /> {t("Load data")}
              </button>
              <button
                onClick={() => setNameDialog({ rename: true })}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-700 hover:border-orange-300"
                title={t("Change the name shown next to your votes")}
              >
                <UserRound className="h-4 w-4 text-orange-600" />
                {myName ? (
                  <>
                    {t("Hi,")} <span className="font-semibold">{myName}</span>
                  </>
                ) : (
                  t("Who are you?")
                )}
                <Pencil className="h-3.5 w-3.5 text-stone-400" />
              </button>
              {myName && (
                <button
                  onClick={() => setVoteFilter((f) => (f === "liked_me" ? DEFAULT_VOTE_FILTER : "liked_me"))}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium ${voteFilter === "liked_me" ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
                  title={t("Show only places I liked")}
                >
                  <Heart className="h-4 w-4" fill="currentColor" /> {t("{n} liked", { n: myLikedCount })}
                </button>
              )}
              {matchCount > 0 && (
                <button
                  onClick={() => setVoteFilter((f) => (f === "matches" ? DEFAULT_VOTE_FILTER : "matches"))}
                  data-testid="match-count"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ${voteFilter === "matches" ? "bg-pink-600 text-white" : "bg-pink-50 text-pink-700 hover:bg-pink-100"}`}
                  title={t("Show only matches")}
                >
                  💞 {plural(matchCount, "{n} match", "{n} matches")}
                </button>
              )}
              {!loading && (
                <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
                  {t("{n} of {total} results", { n: filtered.length, total: items.length })}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {(dataInfo.source === "url" || dataInfo.source === "custom") && (
          <div
            data-testid="data-banner"
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900"
          >
            <span className="min-w-0 truncate">{t("Showing your loaded data: {name}", { name: dataInfo.label || "" })}</span>
            <button onClick={backToDefault} className="ms-auto font-semibold text-sky-800 hover:underline">
              {t("Back to the default data")}
            </button>
          </div>
        )}
        {/* Filters */}
        <div className={`mb-6 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm ${view === "taste" ? "hidden" : ""}`}>
          <div className="flex items-center justify-between sm:hidden">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800"
            >
              <SlidersHorizontal className="w-4 h-4" /> {t("Filters")}
            </button>
            <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-stone-500">
              <RotateCcw className="w-3.5 h-3.5" /> {t("Reset")}
            </button>
          </div>
          <div
            className={`${showFilters ? "mt-4 flex" : "hidden"} flex-col gap-4 sm:mt-0 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-6`}
          >
            <label className="flex items-center gap-2 text-sm text-stone-700">
              {t("Region")}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">{t("All regions")}</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {priceCeil > 0 && (
              <label className="flex items-center gap-3 text-sm text-stone-700">
                <span className="whitespace-nowrap">{t("Max price")}</span>
                <input
                  type="range"
                  min={priceFloor}
                  max={priceCeil}
                  step={100}
                  value={effMax}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-40 accent-orange-600"
                />
                <span className="min-w-[5rem] font-semibold text-orange-800">{priceFiltering ? formatPrice(effMax) : t("No limit")}</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-stone-700">
              {t("Votes")}
              <select
                value={voteFilter}
                onChange={(e) => setVoteFilter(e.target.value)}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="all">{t("All")}</option>
                <option value="liked_any">{t("Someone liked")}</option>
                <option value="liked_me">{t("I liked")}</option>
                <option value="matches">{t("Matches only")}</option>
                <option value="hide_unliked">{t("Hide disliked")}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              {t("Sort")}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                data-testid="sort-select"
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="recommended">{t("Recommended")}</option>
                {items.some(hasFit) && <option value="fit">{t("Fits you best")}</option>}
                <option value="drive">
                  {config.origin.name ? t("Drive time from {origin}", { origin: config.origin.name }) : t("Drive time")}
                </option>
                <option value="price">{t("Final price")}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              {t("Max drive")}
              <select
                value={maxDrive}
                onChange={(e) => setMaxDrive(Number(e.target.value))}
                data-testid="drive-select"
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value={0}>{t("No limit")}</option>
                <option value={90}>{formatDrive(90).replace("~", "")}</option>
                <option value={120}>{formatDrive(120).replace("~", "")}</option>
                <option value={150}>{formatDrive(150).replace("~", "")}</option>
                <option value={180}>{formatDrive(180).replace("~", "")}</option>
              </select>
            </label>
            <Toggle checked={bothJacuzzi} onChange={setBothJacuzzi} label={t("Indoor + outdoor jacuzzi")} />
            <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label={t("Verified availability only")} />
            <button
              onClick={reset}
              className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 sm:ms-auto sm:inline-flex"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t("Reset")}
            </button>
          </div>
        </div>

        {!loading && hiddenUnliked > 0 && (
          <div
            className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-600"
            data-testid="hidden-note"
          >
            <EyeOff className="h-4 w-4 shrink-0 text-stone-400" />
            <span>{plural(hiddenUnliked, "{n} disliked place hidden", "{n} disliked places hidden")}</span>
            <span className="text-stone-300">-</span>
            <button onClick={() => setVoteFilter("all")} className="font-semibold text-orange-700 hover:underline">
              {t("Show")}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
          </div>
        ) : error ? (
          <p className="py-24 text-center text-red-700">{error}</p>
        ) : view === "taste" ? (
          <TasteView prefs={prefs} votes={votes} tripId={config.storage?.votes?.trip_id} />
        ) : view === "map" ? (
          <Suspense
            fallback={
              <div className="flex justify-center py-24">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
              </div>
            }
          >
            <MapView items={mapItems} infoFor={infoFor} onOpen={open} />
          </Suspense>
        ) : filtered.length === 0 && soldOut.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-500">
              <Home className="w-8 h-8" />
            </div>
            <p className="text-lg font-semibold text-stone-700">
              {items.length ? t("No places match the filters") : t("No places yet - ask your agent to run a search (see AGENTS.md)")}
            </p>
            {items.length > 0 && (
              <button onClick={reset} className="mt-3 text-sm text-orange-700 hover:underline">
                {t("Reset filters")}
              </button>
            )}
            {!items.length && (
              <button
                onClick={() => setLoadDialog(true)}
                className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                {t("Load data")}
              </button>
            )}
          </div>
        ) : view === "gallery" ? (
          <GalleryView groups={galleryGroups} onOpen={openViewer} infoFor={infoFor} />
        ) : (
          <>
            {filtered.length === 0 && <p className="py-10 text-center text-stone-600">{t("No available places match the filters")}</p>}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="card-grid">
              {filtered.map((z) => {
                const v = infoFor(z.slug);
                return (
                  <ZimmerCard
                    key={z.id}
                    z={z}
                    onOpen={open}
                    voteInfo={v}
                    onVote={voteFor(z.slug)}
                    dimmed={voteFilter === "all" && isUnliked(v)}
                    match={isMatch(v)}
                    isNew={isNewSince(z, baseline)}
                  />
                );
              })}
            </div>
            {soldOut.length > 0 && (
              <section className="mt-10" data-testid="sold-section">
                <button
                  onClick={() => setShowSold((s) => !s)}
                  className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-start text-base font-bold text-stone-700 hover:bg-stone-200/70"
                  aria-expanded={showSold}
                >
                  <span>{t("Already booked ({n})", { n: soldOut.length })}</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${showSold ? "rotate-180" : ""}`} />
                </button>
                {showSold && (
                  <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {soldOut.map((z) => (
                      <ZimmerCard
                        key={z.id}
                        z={z}
                        onOpen={open}
                        voteInfo={infoFor(z.slug)}
                        onVote={voteFor(z.slug)}
                        soldOut
                        match={isMatch(infoFor(z.slug))}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-stone-400">
        {localized(config.app.title)}
        {config.app.repo_url && (
          <>
            {" · "}
            <a className="hover:underline" href={config.app.repo_url} target="_blank" rel="noopener noreferrer">
              {t("open source")}
            </a>
          </>
        )}
      </footer>

      {viewer && view === "gallery" && (
        <ImmersiveViewer
          photos={viewer.photos}
          start={viewer.index}
          onClose={closeViewer}
          onOpenDetail={open}
          infoFor={infoFor}
          voteFor={voteFor}
          myName={myName}
          suspended={!!selected || !!nameDialog}
        />
      )}

      {selected && (
        <ZimmerDetail
          z={selected}
          onClose={close}
          voteInfo={infoFor(selected.slug)}
          onVote={voteFor(selected.slug)}
          myName={myName}
          match={isMatch(infoFor(selected.slug))}
          isNew={isNewSince(selected, baseline)}
        />
      )}

      {loadDialog && <LoadDataDialog onLoaded={onLoaded} onClose={() => setLoadDialog(false)} />}

      {nameDialog && <NameDialog initial={myName} onSave={saveName} onClose={() => setNameDialog(null)} />}

      {voteError && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl">
            {voteError}
            <button onClick={clearError} aria-label={t("Close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
