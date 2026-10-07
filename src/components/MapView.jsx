import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isMatch } from "@/lib/votes";
import { ORIGIN, shortPrice, finalPrice, formatPrice, formatDrive, photosOf, small, isSoldOut } from "@/lib/zimmer-utils";
import { t, dir } from "@/i18n";
import config, { NIGHTS } from "@/config";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Coordinates are town level, so several zimmers can share a point: spread duplicates on a small circle.
function spread(list) {
  const groups = new Map();
  for (const z of list) {
    const k = `${z.lat.toFixed(4)},${z.lng.toFixed(4)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(z);
  }
  const out = [];
  for (const g of groups.values()) {
    g.forEach((z, i) => {
      if (g.length === 1) {
        out.push([z, z.lat, z.lng]);
        return;
      }
      const a = (2 * Math.PI * i) / g.length,
        r = 0.006; // ~600m
      out.push([z, z.lat + r * Math.cos(a), z.lng + (r * Math.sin(a)) / Math.cos((z.lat * Math.PI) / 180)]);
    });
  }
  return out;
}

function pinHtml(kind, label) {
  const colors = { match: "#db2777", liked: "#f43f5e", sold: "#78716c", base: "#ea580c" };
  const c = colors[kind];
  const heart = kind === "match" ? "💞" : kind === "liked" ? "♥" : "";
  return `<div class="zpin zpin-${kind}" style="--c:${c}"><span>${heart ? `<b>${heart}</b>` : ""}${esc(label)}</span></div>`;
}

function refit(m) {
  m._fitting = true;
  m.fitBounds(m._fitPts, { padding: [24, 24], maxZoom: 11, animate: false });
  setTimeout(() => {
    m._fitting = false;
  }, 0);
}

export default function MapView({ items, infoFor, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, tap: false, zoomSnap: 0.5, zoomDelta: 1 }).setView(
      config.region.map_center || [0, 0],
      config.region.map_zoom || 2,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    if (typeof ORIGIN.lat === "number" && typeof ORIGIN.lng === "number")
      L.marker([ORIGIN.lat, ORIGIN.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="zpin-home">🏠 ${esc(ORIGIN.name || t("Start"))}</div>`,
          iconSize: [90, 28],
          iconAnchor: [45, 14],
        }),
        keyboard: false,
        zIndexOffset: -500,
      })
        .addTo(m)
        .bindTooltip(t("Starting point: {origin}", { origin: ORIGIN.name }));
    layer.current = L.layerGroup().addTo(m);
    // zoomed out: small dots instead of price labels so nearby pins don't cover each other
    const compact = () => el.current && el.current.classList.toggle("zmap-compact", m.getZoom() < 9);
    m.on("zoomend", compact);
    compact();
    map.current = m;
    const onClick = (e) => {
      const b = e.target.closest && e.target.closest("[data-open-slug]");
      if (!b) return;
      const z = (map.current._zItems || []).find((i) => i.slug === b.getAttribute("data-open-slug"));
      if (z) openRef.current(z);
    };
    el.current.addEventListener("click", onClick);
    // until the user moves the map, keep the pins fitted when the container size settles
    m._userMoved = false;
    const mark = () => {
      m._userMoved = true;
    };
    m.on("dragstart", mark);
    m.on("zoomstart", () => {
      if (!m._fitting) mark();
    });
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (!m._userMoved && m._fitPts) refit(m);
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    const withCoords = items.filter((z) => typeof z.lat === "number" && typeof z.lng === "number");
    m._zItems = withCoords;
    const pts = typeof ORIGIN.lat === "number" && typeof ORIGIN.lng === "number" ? [[ORIGIN.lat, ORIGIN.lng]] : [];
    for (const [z, lat, lng] of spread(withCoords)) {
      const info = infoFor(z.slug);
      const kind = isSoldOut(z) ? "sold" : isMatch(info) ? "match" : info.likes.length ? "liked" : "base";
      const price = formatPrice(finalPrice(z));
      const fp = finalPrice(z);
      const label = typeof fp === "number" ? shortPrice(fp) : `#${z.score ?? ""}`;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "zimmer-pin",
          html: pinHtml(kind, label),
          iconSize: [74, 30],
          iconAnchor: [37, 30],
          popupAnchor: [0, -28],
        }),
        title: z.name,
        zIndexOffset: kind === "match" ? 1000 : kind === "liked" ? 500 : kind === "sold" ? -100 : 0,
        riseOnHover: true,
      });
      const ph = photosOf(z)[0];
      const img = ph ? small(ph.src, ph.thumb, 480) : null;
      const drive = formatDrive(z.drive_minutes);
      marker.bindPopup(
        `<div class="zpop" dir="${dir}" data-testid="map-popup">
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy"/>` : ""}
          <div class="zpop-body">
            ${kind === "match" ? `<div class="zpop-match">💞 ${esc(t("Match"))}</div>` : ""}
            ${kind === "sold" ? `<div class="zpop-sold">${esc(t("Already booked"))}</div>` : ""}
            <div class="zpop-name">${esc(z.name)}</div>
            <div class="zpop-town">${esc([z.town, z.region].filter(Boolean).join(" · "))}</div>
            <div class="zpop-price">${esc(price || t("Price unknown"))} <small>${esc(t("for {nights} nights", { nights: NIGHTS ?? "?" }))}${z.price_status === "verified" ? " · " + esc(t("verified")) : z.price_status ? " · " + esc(t("estimated")) : ""}</small></div>
            ${drive ? `<div class="zpop-drive">🚗 ${esc(ORIGIN.name ? t("{time} from {origin}", { time: drive, origin: ORIGIN.name }) : drive)}${typeof z.drive_km === "number" ? ` · ${esc(t("{km} km", { km: Math.round(z.drive_km) }))}` : ""}</div>` : ""}
            <button type="button" class="zpop-btn" data-open-slug="${esc(z.slug)}">${esc(t("Details"))}</button>
          </div>
        </div>`,
        { maxWidth: 240, minWidth: 220, autoPanPadding: [20, 60] },
      );
      marker.addTo(layer.current);
      pts.push([lat, lng]);
    }
    m._fitPts = pts.length > 1 ? pts : null;
    if (m._fitPts) {
      m._userMoved = false;
      refit(m);
    }
  }, [items, infoFor]);

  const count = items.filter((z) => typeof z.lat === "number").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
        <span className="font-semibold text-stone-800">{t("{n} places on the map", { n: count })}</span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: "#db2777" }} /> {t("Match")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: "#f43f5e" }} /> {t("Someone liked")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: "#ea580c" }} /> {t("Other places")}
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: "#78716c" }} /> {t("Already booked")}
        </span>
        <span className="text-stone-400">{t("Town-level locations; drive times without traffic; zoom in to see prices")}</span>
      </div>
      <div
        ref={el}
        data-testid="map"
        className="z-0 h-[65vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-stone-200 shadow-sm sm:h-[72vh]"
      />
    </div>
  );
}
