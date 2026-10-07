import { useState } from "react";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { small } from "@/lib/zimmer-utils";
import { useSnapCarousel } from "@/lib/useSnapCarousel";
import { t } from "@/i18n";

function Slide({ src, thumb, alt, load }) {
  const [failed, setFailed] = useState(false);
  const [useOrig, setUseOrig] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-stone-100">
      {!src || failed ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 via-orange-50 to-stone-100 text-orange-300">
          <Home className="h-12 w-12" strokeWidth={1.5} />
        </div>
      ) : load ? (
        <img
          src={useOrig ? src : small(src, thumb, 720)}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => (useOrig ? setFailed(true) : setUseOrig(true))}
          className={`h-full w-full select-none object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
      {src && !failed && !loaded && <div className="absolute inset-0 animate-pulse bg-stone-200/70" />}
    </div>
  );
}

// Card image carousel: native swipe (scroll-snap) on touch, arrows on hover devices, dots.
// The track is LTR on purpose: swipe left (finger right-to-left) = next image, app-wide.
// Arrows / dots stop propagation so they never open the detail view; a plain tap bubbles up.
export default function ImageCarousel({ images, thumbs = [], alt = "", className = "" }) {
  const count = images.length;
  const { ref, index, goTo, next, prev, onScroll } = useSnapCarousel(count);
  // lazy: only mount images near the current / already visited slides
  const [maxSeen, setMaxSeen] = useState(0);
  if (index > maxSeen) setMaxSeen(index);

  const stop = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  const arrow =
    "absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-1.5 text-stone-800 shadow-md transition-opacity hover:bg-white focus-visible:opacity-100 [@media(hover:hover)]:flex opacity-0 group-hover/car:opacity-100";

  if (!count)
    return (
      <div className={className}>
        <Slide src={null} alt={alt} load />
      </div>
    );

  return (
    <div className={`group/car relative overflow-hidden ${className}`}>
      <div
        ref={ref}
        dir="ltr"
        onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
        aria-roledescription="carousel"
      >
        {images.map((src, i) => (
          <Slide key={src + i} src={src} thumb={thumbs[i]} alt={`${alt} - ${t("photo {n}", { n: i + 1 })}`} load={i <= maxSeen + 1} />
        ))}
      </div>
      {count > 1 && (
        <>
          <button type="button" onClick={stop(prev)} className={`${arrow} left-2`} aria-label={t("Previous photo")}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={stop(next)} className={`${arrow} right-2`} aria-label={t("Next photo")}>
            <ChevronRight className="h-5 w-5" />
          </button>
          {count > 8 ? (
            <span
              dir="ltr"
              className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-white"
            >
              {index + 1} / {count}
            </span>
          ) : (
            <div
              className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-2 py-1 backdrop-blur-sm"
              dir="ltr"
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={stop(() => goTo(i))}
                  aria-label={t("Photo {n}", { n: i + 1 })}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60 hover:bg-white/90"}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
