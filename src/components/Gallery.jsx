import { useState } from "react";
import { Images, Home } from "lucide-react";
import { sized, small } from "@/lib/zimmer-utils";
import Lightbox from "./Lightbox";
import { t, plural } from "@/i18n";

function Thumb({ src, thumb, alt, w, className = "", onClick, overlay }) {
  const [failed, setFailed] = useState(false);
  const [useOrig, setUseOrig] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl bg-stone-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 ${className}`}
      aria-label={alt}
    >
      {failed ? (
        <div className="flex h-full w-full items-center justify-center text-orange-300">
          <Home className="h-8 w-8" />
        </div>
      ) : (
        <img
          src={useOrig ? src : thumb === undefined ? sized(src, w) : small(src, thumb, w)}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => (useOrig ? setFailed(true) : setUseOrig(true))}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-stone-200" />}
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      {overlay}
    </button>
  );
}

// Organized gallery: first image large, the rest as a clean thumbnail grid. Click opens the lightbox.
// The large first tile uses the full image; the small tiles and the lightbox strip use thumbnails.
export default function Gallery({ images, thumbs = [], alt = "" }) {
  const [open, setOpen] = useState(null);
  if (!images.length) return null;
  const MAX_THUMBS = 8;
  const [first, ...others] = images;
  const rest = others.slice(0, MAX_THUMBS);
  const hidden = others.length - rest.length;
  return (
    <>
      <div className={`grid gap-2 ${rest.length ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}>
        <Thumb
          src={first}
          w={1200}
          alt={`${alt} - ${t("photo {n}", { n: 1 })}`}
          onClick={() => setOpen(0)}
          className={rest.length ? "col-span-2 aspect-[16/10] sm:row-span-2 sm:aspect-auto sm:min-h-[260px]" : "aspect-[16/9]"}
          overlay={
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
              <Images className="h-3.5 w-3.5" /> {plural(images.length, "{n} photo", "{n} photos")}
            </span>
          }
        />
        {rest.map((src, i) => (
          <Thumb
            key={src + i}
            src={src}
            thumb={thumbs[i + 1] || null}
            w={480}
            alt={`${alt} - ${t("photo {n}", { n: i + 2 })}`}
            onClick={() => setOpen(i + 1)}
            className="aspect-[4/3]"
            overlay={
              hidden > 0 && i === rest.length - 1 ? (
                <span dir="ltr" className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">
                  +{hidden + 1}
                </span>
              ) : null
            }
          />
        ))}
      </div>
      {open !== null && <Lightbox images={images} thumbs={thumbs} start={open} alt={alt} onClose={() => setOpen(null)} />}
    </>
  );
}
