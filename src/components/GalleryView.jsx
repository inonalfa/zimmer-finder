import { useState } from "react";
import { Images, MapPin, Heart, Home } from "lucide-react";
import { small, formatPrice, finalPrice } from "@/lib/zimmer-utils";
import { t, plural } from "@/i18n";

function Tile({ photo, onClick, eager }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useOrig, setUseOrig] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden bg-stone-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-orange-400"
      aria-label={`${photo.z.name} - ${t("photo {n} of {total}", { n: photo.i + 1, total: photo.n })}`}
      data-testid="gallery-tile"
    >
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-orange-300">
          <Home className="h-8 w-8" />
        </div>
      ) : (
        <img
          src={useOrig ? photo.src : small(photo.src, photo.thumb, 320)}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => (useOrig ? setFailed(true) : setUseOrig(true))}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-stone-200" />}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-right text-[10px] font-medium leading-tight text-white sm:text-xs">
        {photo.z.name}
      </span>
    </button>
  );
}

// All photos of all (filtered) zimmers, grouped by zimmer. Tap a photo to open the immersive viewer.
export default function GalleryView({ groups, onOpen, infoFor }) {
  const total = groups.reduce((n, g) => n + g.photos.length, 0);
  if (!total) {
    return (
      <div className="py-24 text-center text-stone-600">
        <Images className="mx-auto mb-3 h-10 w-10 text-orange-300" />
        {t("No photos match the current filters")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6" data-testid="gallery-grid">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <span>{t("{photos} photos from {places} places", { photos: total, places: groups.length })}</span>
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
        >
          <Images className="h-4 w-4" /> {t("Full-screen view")}
        </button>
      </div>
      {groups.map(({ z, photos, offset }, gi) => {
        const rows = Math.ceil(photos.length / 3);
        const mine = infoFor(z.slug).mine;
        return (
          <section
            key={z.id || z.slug}
            className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
            style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${rows * 140 + 64}px` }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-stone-900">
                  {typeof z.score === "number" && <span className="me-1.5 text-orange-600">#{z.score}</span>}
                  {z.name}
                </h2>
                <p className="flex items-center gap-1 truncate text-xs text-stone-500">
                  <MapPin className="h-3 w-3 shrink-0" /> {[z.region, z.town].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
                {mine === "like" && <Heart className="h-4 w-4 text-rose-500" fill="currentColor" />}
                <span className="font-bold text-orange-700">{formatPrice(finalPrice(z))}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5">{plural(photos.length, "{n} photo", "{n} photos")}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 lg:grid-cols-6">
              {photos.map((p, i) => (
                <Tile key={p.src + i} photo={p} eager={gi === 0 && i < 6} onClick={() => onOpen(offset + i)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
