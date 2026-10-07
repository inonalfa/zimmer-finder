import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { sized, small } from "@/lib/zimmer-utils";
import { useSnapCarousel } from "@/lib/useSnapCarousel";
import { t } from "@/i18n";

function LbImage({ src, alt, load }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative flex h-full w-full shrink-0 snap-center snap-always items-center justify-center p-2 sm:p-10">
      {load && (
        <img
          src={sized(src, 1440)}
          alt={alt}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          className={`max-h-full max-w-full select-none object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!loaded && <div className="absolute h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-white" />}
    </div>
  );
}

export default function Lightbox({ images, thumbs = [], start = 0, alt = "", onClose }) {
  const count = images.length;
  const { ref, index, goTo, next, prev, onScroll } = useSnapCarousel(count, start);

  useEffect(() => {
    // capture phase so the detail modal behind does not also react (e.g. close on Escape)
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        next();
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        prev();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, prev, onClose]);

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  const strip = useRef(null);
  useEffect(() => {
    const el = strip.current?.querySelector(`[data-i="${index}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={t("Photo gallery")}
      onClick={stop(() => {})}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <span dir="ltr" className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums">
          {index + 1} / {count}
        </span>
        <button type="button" onClick={stop(onClose)} className="rounded-full bg-white/10 p-2.5 hover:bg-white/20" aria-label={t("Close")}>
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={ref}
          dir="ltr"
          onScroll={onScroll}
          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {images.map((src, i) => (
            <LbImage key={src + i} src={src} alt={`${alt} - ${t("photo {n}", { n: i + 1 })}`} load={Math.abs(i - index) <= 1} />
          ))}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={stop(prev)}
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30 sm:block"
              aria-label={t("Previous photo")}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={stop(next)}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30 sm:block"
              aria-label={t("Next photo")}
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div
          ref={strip}
          dir="ltr"
          className="no-scrollbar overflow-x-auto px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex w-max gap-2">
            {images.map((src, i) => (
              <button
                data-i={i}
                key={src + i}
                type="button"
                onClick={stop(() => goTo(i))}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${i === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-90"}`}
                aria-label={t("Photo {n}", { n: i + 1 })}
              >
                <img
                  src={small(src, thumbs[i], 240)}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (e.currentTarget.src !== src) e.currentTarget.src = src;
                  }}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
