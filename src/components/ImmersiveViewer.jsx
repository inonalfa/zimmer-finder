import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MapPin,
  Sparkles,
  ThumbsUp,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Star,
} from "lucide-react";
import ContactButtons from "./ContactButtons";
import VoteBar from "./VoteBar";
import { sized, formatPrice, featureBadges, ratingsOf, finalPrice, perNight } from "@/lib/zimmer-utils";
import { MatchBadge, PriceStatusChip, CheckedAt, PriceChangeTag, DriveTag } from "./ZimmerExtras";
import { isMatch } from "@/lib/votes";
import RatingBadges from "./RatingBadges";
import { t, dir as textDir } from "@/i18n";
import { NIGHTS } from "@/config";

const PANEL = 58; // % of the viewer height taken by the details panel when expanded
const SWIPE_DIST = 0.18; // fraction of width to commit a horizontal swipe
const SWIPE_VEL = 0.35; // px/ms to commit a flick
const EASE = "cubic-bezier(.22,.8,.24,1)";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DOUBLE_TAP_MS = 280; // second tap within this window = double tap (single-tap action waits for it)
const HINT_KEY = "zimmer_doubletap_hint_seen";

function Slide({ photo, offset, onLoad }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateX(${offset * 100}%)` }}>
      {!loaded && <div className="absolute h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-white" />}
      <img
        src={sized(photo.src, 1440)}
        alt={`${photo.z.name} - ${t("photo {n}", { n: photo.i + 1 })}`}
        draggable={false}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className={`pointer-events-none h-full w-full select-none object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

// Fullscreen, touch-first photo viewer across all zimmers.
// Swipe left = next photo (continuous across zimmers), swipe up = shrink photo + details panel, swipe down / tap = back.
export default function ImmersiveViewer({ photos, start = 0, onClose, onOpenDetail, infoFor, voteFor, myName, suspended = false }) {
  const count = photos.length;
  const [index, setIndex] = useState(clamp(start, 0, Math.max(0, count - 1)));
  const [expanded, setExpanded] = useState(false);
  const [chrome, setChrome] = useState(true);
  const root = useRef(null),
    stage = useRef(null),
    track = useRef(null),
    panel = useRef(null),
    panelScroll = useRef(null);
  const g = useRef(null); // current gesture
  const anim = useRef(false);
  const lastTap = useRef(null); // { t, x, y } of the previous tap on the photo
  const tapTimer = useRef(null); // pending single-tap action
  const [jump, setJump] = useState(null); // { dir, text, key } feedback chip
  const [hint, setHint] = useState(false);

  const photo = photos[index];
  const z = photo?.z;
  const hasPrev = index > 0,
    hasNext = index < count - 1;

  // ---- imperative style helpers (no re-render while dragging) ----
  const applyP = (p, animate) => {
    const t = animate ? `height 320ms ${EASE}` : "none";
    if (stage.current) {
      stage.current.style.transition = t;
      stage.current.style.height = `calc(100% - ${p * PANEL}%)`;
    }
    if (panel.current) {
      panel.current.style.transition = animate ? `height 320ms ${EASE}, opacity 320ms ${EASE}` : "none";
      panel.current.style.height = `${p * PANEL}%`;
      panel.current.style.opacity = String(clamp(p * 1.6, 0, 1));
    }
    root.current?.style.setProperty("--p", String(p));
  };
  const setTrack = (px, animate, ms = 280) => {
    if (!track.current) return;
    track.current.style.transition = animate ? `transform ${ms}ms ${EASE}` : "none";
    track.current.style.transform = `translate3d(${px}px,0,0)`;
  };

  const go = useCallback(
    (dir) => {
      if (anim.current) return;
      const target = index + dir;
      if (target < 0 || target >= count) {
        setTrack(0, true);
        return;
      }
      const w = stage.current?.clientWidth || window.innerWidth;
      anim.current = true;
      setTrack(-dir * w, true);
      const done = () => {
        anim.current = false;
        setIndex(target);
      };
      let fired = false;
      const el = track.current;
      const once = () => {
        if (!fired) {
          fired = true;
          el?.removeEventListener("transitionend", onEnd);
          done();
        }
      };
      // ignore transitionend events bubbling up from children (e.g. image fade-in)
      const onEnd = (e) => {
        if (e.target === el && e.propertyName === "transform") once();
      };
      el?.addEventListener("transitionend", onEnd);
      setTimeout(once, 340);
    },
    [index, count],
  );

  // ---- jump to the next / previous zimmer (first photo), wrapping around ----
  const groupStart = (k) => {
    while (k > 0 && photos[k - 1].z.slug === photos[k].z.slug) k--;
    return k;
  };
  const jumpZimmer = useCallback(
    (dir) => {
      if (!count || anim.current) return;
      const cur = groupStart(index);
      let target,
        wrapped = false;
      if (dir > 0) {
        let k = index;
        while (k < count && photos[k].z.slug === photos[index].z.slug) k++;
        if (k >= count) {
          k = 0;
          wrapped = true;
        }
        target = k;
      } else {
        if (cur === 0) {
          target = groupStart(count - 1);
          wrapped = true;
        } else target = groupStart(cur - 1);
      }
      if (target === cur) return; // only one zimmer
      const name = photos[target].z.name;
      setJump({ dir, name, wrapped, key: Date.now() });
      if (track.current) {
        track.current.style.transition = "none";
        track.current.style.opacity = "0.25";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!track.current) return;
            track.current.style.transition = `opacity 260ms ${EASE}`;
            track.current.style.opacity = "1";
          }),
        );
      }
      setIndex(target);
    },
    [index, count, photos],
  );

  // jump chip fades out by itself
  useEffect(() => {
    if (!jump) return;
    const t = setTimeout(() => setJump(null), 1600);
    return () => clearTimeout(t);
  }, [jump]);

  // one-time hint on first open
  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(HINT_KEY);
      localStorage.setItem(HINT_KEY, "1");
    } catch (e) {}
    if (seen) return;
    setHint(true);
    const t = setTimeout(() => setHint(false), 3800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  // after the index changes, recenter the track instantly (the slide that slid in is now offset 0)
  useLayoutEffect(() => {
    setTrack(0, false);
  }, [index]);

  const setExp = useCallback((v) => {
    applyP(v ? 1 : 0, true);
    setExpanded(v);
    if (v) setChrome(true);
  }, []);

  // keep styles in sync with state on mount / resize
  useLayoutEffect(() => {
    applyP(expanded ? 1 : 0, false);
  }, []);

  // scroll details to top when moving to another zimmer
  const zslug = z?.slug;
  useEffect(() => {
    if (panelScroll.current) panelScroll.current.scrollTop = 0;
  }, [zslug]);

  // preload neighbours
  useEffect(() => {
    for (let k = index - 2; k <= index + 3; k++) {
      if (k === index || k < 0 || k >= count) continue;
      const im = new Image();
      im.referrerPolicy = "no-referrer";
      im.src = sized(photos[k].src, 1440);
    }
  }, [index, photos, count]);

  // lock page scroll / bounce while open
  useEffect(() => {
    const b = document.body.style.overflow,
      o = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = b;
      document.documentElement.style.overscrollBehavior = o;
    };
  }, []);

  // keyboard (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (suspended) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        jumpZimmer(1);
      } else if (e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        jumpZimmer(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setExp(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setExp(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, jumpZimmer, setExp, onClose, suspended]);

  // ---- gestures ----
  const onDown = (yOnly) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest && e.target.closest("button, a, input, select")) return;
    if (anim.current) return;
    g.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      axis: yOnly ? "y?" : null,
      dx: 0,
      dy: 0,
      p: expanded ? 1 : 0,
      yOnly,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
  };
  const onMove = (e) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    s.dx = dx;
    s.dy = dy;
    if (!s.axis || s.axis === "y?") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      lastTap.current = null; // a drag is not part of a double tap
      s.axis = s.yOnly ? "y" : Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (e.cancelable) e.preventDefault();
    if (s.axis === "x") {
      const blocked = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
      setTrack(blocked ? dx * 0.25 : dx, false);
    } else {
      const H = root.current?.clientHeight || window.innerHeight;
      const base = expanded ? 1 : 0;
      let p = base - dy / ((H * PANEL) / 100);
      p = p < 0 ? p * 0.15 : p > 1 ? 1 + (p - 1) * 0.15 : p; // rubber band
      s.p = p;
      applyP(clamp(p, -0.05, 1.05), false);
    }
  };
  const onUp = (e) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    g.current = null;
    const dt = Math.max(1, performance.now() - s.t);
    if (!s.axis || s.axis === "y?") {
      // tap on the panel handle: immediate toggle
      if (s.yOnly) {
        setExp(!expanded);
        return;
      }
      // tap on the photo: double tap (right half = next zimmer, left half = previous) or, after the
      // double-tap window, the single-tap action (shrunk: back to fullscreen, fullscreen: toggle overlays)
      const now = performance.now();
      const prev = lastTap.current;
      if (prev && now - prev.t <= DOUBLE_TAP_MS && Math.abs(e.clientX - prev.x) < 60 && Math.abs(e.clientY - prev.y) < 60) {
        lastTap.current = null;
        clearTimeout(tapTimer.current);
        const r = stage.current.getBoundingClientRect();
        jumpZimmer(e.clientX >= r.left + r.width / 2 ? 1 : -1);
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      clearTimeout(tapTimer.current);
      const wasExpanded = expanded;
      tapTimer.current = setTimeout(() => {
        lastTap.current = null;
        if (wasExpanded) setExp(false);
        else setChrome((c) => !c);
      }, DOUBLE_TAP_MS);
      return;
    }
    if (s.axis === "x") {
      const w = stage.current?.clientWidth || window.innerWidth;
      const v = s.dx / dt;
      if ((s.dx < -w * SWIPE_DIST || v < -SWIPE_VEL) && hasNext) go(1);
      else if ((s.dx > w * SWIPE_DIST || v > SWIPE_VEL) && hasPrev) go(-1);
      else setTrack(0, true, 220);
    } else {
      const v = s.dy / dt; // negative = up
      let target = s.p > 0.5;
      if (v < -SWIPE_VEL) target = true;
      if (v > SWIPE_VEL) target = false;
      setExp(target);
    }
  };
  const onCancel = () => {
    g.current = null;
    setTrack(0, true, 200);
    applyP(expanded ? 1 : 0, true);
  };

  if (!photo) return null;
  const info = infoFor(z.slug);
  const price = formatPrice(finalPrice(z));
  const night = formatPrice(perNight(z));
  const match = isMatch(info);
  const place = [z.region, z.town].filter(Boolean).join(" · ");
  const zimmerNo = photos.slice(0, index + 1).reduce((n, ph, k) => (k === 0 || ph.z.slug !== photos[k - 1].z.slug ? n + 1 : n), 0);
  const zimmerTotal = photos.reduce((n, ph, k) => (k === 0 || ph.z.slug !== photos[k - 1].z.slug ? n + 1 : n), 0);
  const badges = featureBadges(z);
  const handlers = (yOnly) => ({ onPointerDown: onDown(yOnly), onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onCancel });
  const btn =
    "flex items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 active:scale-95";

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-black text-white"
      style={{ height: "100dvh", "--p": 0, touchAction: "manipulation" }}
      role="dialog"
      aria-label={t("Gallery of all places")}
      data-expanded={expanded ? "1" : "0"}
    >
      {/* PHOTO STAGE */}
      <div
        ref={stage}
        className="relative w-full shrink-0 select-none overflow-hidden"
        style={{ height: "100%", touchAction: "none" }}
        {...handlers(false)}
        onDoubleClick={(e) => e.preventDefault()}
        data-testid="viewer-stage"
      >
        <div ref={track} className="absolute inset-0 will-change-transform" dir="ltr">
          {[-1, 0, 1].map((off) => {
            const k = index + off;
            if (k < 0 || k >= count) return null;
            return <Slide key={k} photo={photos[k]} offset={off} />;
          })}
        </div>

        {/* top overlay: close, name, counter */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 via-black/25 to-transparent px-3 pb-10 transition-opacity duration-300 ${chrome ? "opacity-100" : "opacity-0"}`}
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`${btn} pointer-events-auto h-10 w-10 shrink-0`}
              aria-label={t("Close gallery")}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-base font-bold drop-shadow" data-testid="viewer-name">
                {z.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span
                  dir="ltr"
                  className="rounded-full bg-white/20 px-2 py-0.5 font-semibold tabular-nums text-white"
                  data-testid="viewer-counter"
                >
                  {photo.i + 1} / {photo.n}
                </span>
                <span>{t("Place {n} of {total}", { n: zimmerNo, total: zimmerTotal })}</span>
                {price && <span className="font-semibold text-white">{price}</span>}
              </div>
            </div>
            {match ? (
              <MatchBadge className="shrink-0" />
            ) : (
              info.mine === "like" && (
                <span className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold">{t("You liked")}</span>
              )
            )}
          </div>
        </div>

        {/* double-tap jump feedback */}
        {jump && (
          <div
            key={jump.key}
            className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 px-4 ${jump.dir > 0 ? "right-0" : "left-0"}`}
          >
            <div
              data-testid="jump-chip"
              data-dir={jump.dir > 0 ? "next" : "prev"}
              dir={textDir}
              className="zjump flex max-w-[78vw] items-center gap-2 rounded-2xl bg-black/70 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            >
              {jump.dir > 0 && (
                <span className="text-lg leading-none" aria-hidden>
                  ⟩⟩
                </span>
              )}
              <span className="truncate">
                {jump.dir > 0 ? t("Next place") : t("Previous place")}: {jump.name}
                {jump.wrapped && <span className="font-normal text-white/70"> {t("(from the start)")}</span>}
              </span>
              {jump.dir < 0 && (
                <span className="text-lg leading-none" aria-hidden>
                  ⟨⟨
                </span>
              )}
            </div>
          </div>
        )}
        {hint && !jump && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
            <div
              data-testid="doubletap-hint"
              className="zhint rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white/95 backdrop-blur-md"
            >
              {t("Double-tap the right side for the next place · the left side for the previous one")}
            </div>
          </div>
        )}

        {/* desktop arrows (next on the right: swipe left = next) */}
        {hasPrev && (
          <button
            type="button"
            onClick={() => go(-1)}
            className={`${btn} absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 [@media(hover:hover)]:flex`}
            aria-label={t("Previous photo")}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => go(1)}
            className={`${btn} absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 [@media(hover:hover)]:flex`}
            aria-label={t("Next photo")}
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        {/* bottom hint / toggle */}
        <div
          className={`absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent pt-10 transition-opacity duration-300 ${chrome && !expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setExp(true)}
            className="flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1 text-sm font-medium text-white/90"
            aria-label={t("Show place details")}
          >
            <ChevronUp className="h-6 w-6 animate-bounce" />
            {t("Swipe up for details")}
          </button>
        </div>
      </div>

      {/* DETAILS PANEL */}
      <div
        ref={panel}
        className="relative w-full shrink-0 overflow-hidden rounded-t-3xl bg-[#fffdf9] text-stone-900"
        style={{ height: "0%", opacity: 0 }}
        data-testid="viewer-panel"
        dir={textDir}
      >
        <div className="flex cursor-grab items-center justify-center py-2.5" style={{ touchAction: "none" }} {...handlers(true)}>
          <span className="h-1.5 w-11 rounded-full bg-stone-300" />
          <button
            type="button"
            onClick={() => setExp(false)}
            className="absolute left-3 top-1.5 rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label={t("Back to full photo")}
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
        <div
          ref={panelScroll}
          className="h-[calc(100%-2.25rem)] overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {match && <MatchBadge className="mb-1.5" />}
                <h2 className="text-xl font-extrabold leading-tight" data-testid="panel-name">
                  {z.name}
                </h2>
                {place && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-stone-600">
                    <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
                    {place}
                  </p>
                )}
                <DriveTag z={z} className="mt-0.5" />
                {ratingsOf(z).length ? (
                  <RatingBadges z={z} size="xs" className="mt-1.5" />
                ) : (
                  z.rating && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {z.rating}
                    </p>
                  )
                )}
              </div>
              <div className="shrink-0 text-left">
                <div className="flex items-center justify-end gap-1">
                  <PriceChangeTag z={z} />
                  <span className="text-2xl font-extrabold text-orange-700">{price || t("Price unknown")}</span>
                </div>
                <div className="text-xs text-stone-500">{t("{nights} nights incl. taxes", { nights: NIGHTS ?? "?" })}</div>
                {night && <div className="text-xs text-stone-500">{t("{price} per night", { price: night })}</div>}
                <div className="mt-1 flex flex-col items-end gap-0.5">
                  <PriceStatusChip z={z} />
                  <CheckedAt z={z} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.key}
                  className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-900"
                >
                  {b.label}
                </span>
              ))}
              {z.has_pool && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-900">
                  {t("Pool")}
                </span>
              )}
              {z.availability_status === "verified" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> {t("Availability verified")}
                </span>
              )}
              {z.within_budget === false && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs text-red-700">{t("Over budget")}</span>
              )}
            </div>

            {z.summary && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-violet-900">
                  <Sparkles className="h-4 w-4" /> {t("AI summary")}
                </div>
                <p className="text-[15px] leading-relaxed text-stone-800">{z.summary}</p>
              </div>
            )}

            <ContactButtons z={z} size="lg" />

            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-stone-800">
                <ThumbsUp className="h-4 w-4 text-rose-500" /> {t("What do you think?")}
              </div>
              <VoteBar info={info} onVote={voteFor(z.slug)} full myName={myName} />
            </div>

            {z.review_summary && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                  <ThumbsUp className="h-4 w-4" /> {t("What guests say")}
                </div>
                <p className="text-sm leading-relaxed text-stone-700">{z.review_summary}</p>
              </div>
            )}
            {z.review_red_flags && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3.5">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-red-800">
                  <AlertTriangle className="h-4 w-4" /> {t("Red flags")}
                </div>
                <p className="text-sm leading-relaxed text-stone-700">{z.review_red_flags}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => onOpenDetail(z)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3.5 text-base font-semibold text-white hover:bg-stone-800"
            >
              {t("Full details page")} <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
