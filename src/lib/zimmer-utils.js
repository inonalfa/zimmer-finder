import config, { NIGHTS } from "@/config";
import { locale, t } from "@/i18n";

const money = (() => {
  try {
    return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
      style: "currency",
      currency: config.app.currency || "USD",
      maximumFractionDigits: 0,
    });
  } catch {
    return null;
  }
})();
export const formatPrice = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? (money ? money.format(Math.round(n)) : Math.round(n).toLocaleString("en-US")) : null;

// Compact label for map pins, e.g. "₪4.3K"
export const shortPrice = (n) => {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  const sym = money ? (money.formatToParts(0).find((x) => x.type === "currency") || {}).value || "" : "";
  return n >= 1000 ? `${sym}${(n / 1000).toFixed(1)}K` : `${sym}${Math.round(n)}`;
};

export const formatDate = (d) => {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d);
  return locale === "en" ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}/${m[2]}/${m[1]}`;
};

export const toWhatsApp = (num) => {
  const p = firstPhone(num);
  if (!p) return null;
  let d = p.replace(/\D/g, "");
  if (!d) return null;
  d = toIntl(d);
  return d ? `https://wa.me/${d}` : null;
};

// First phone-like token in a free-text field, e.g. "050-0000000 (note); 04-..." -> "050-0000000"
export const firstPhone = (num) => {
  if (!num) return null;
  const m = String(num).match(/\+?\d[\d\s-]{6,}\d/);
  return m ? m[0].trim() : null;
};

// Full original text when the field has more than just the number (source notes etc.)
export const phoneNote = (num) => {
  const p = firstPhone(num);
  if (!p) return null;
  const t = String(num).trim();
  return t !== p ? t : null;
};

export const toTel = (num) => {
  const p = firstPhone(num);
  if (!p) return null;
  const d = p.replace(/[^\d+]/g, "");
  return d ? `tel:${d}` : null;
};

export const siteLink = (z) => z.website_url || z.listing_url || null;

// Photos as {src, thumb}: src = full image (viewers / lightbox), thumb = small copy (~480px) from
// thumb_urls (same order as image_urls) when present and aligned, else null. Deduped by src.
export const photosOf = (z) => {
  const urls = Array.isArray(z?.image_urls) ? z.image_urls : [];
  const th = Array.isArray(z?.thumb_urls) && z.thumb_urls.length === urls.length ? z.thumb_urls : [];
  const seen = new Set();
  const out = [];
  urls.forEach((u, i) => {
    if (typeof u !== "string" || !u.trim() || seen.has(u)) return;
    seen.add(u);
    const t = th[i];
    out.push({ src: u, thumb: typeof t === "string" && t.trim() ? t : null });
  });
  return out;
};

export const imagesOf = (z) => photosOf(z).map((p) => p.src);
export const thumbsOf = (z) => photosOf(z).map((p) => p.thumb);

export const firstImage = (z) => imagesOf(z)[0] || null;

// Ask the image CDN for a resized copy when it supports it (Airbnb muscache: ?im_w=)
export const sized = (url, w) => {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (/(^|\.)muscache\.com$/.test(u.hostname)) {
      // muscache only serves a fixed set of widths (others return 404)
      const W = [240, 320, 480, 720, 960, 1200, 1440];
      u.searchParams.set("im_w", String(W.find((x) => x >= w) || 1440));
      return u.toString();
    }
  } catch (e) {
    /* not a URL */
  }
  return url;
};

// Small image for grids / cards / strips: the stored thumbnail when there is one, else a resized CDN copy
export const small = (src, thumb, w) => thumb || sized(src, w);

// Structured ratings for badges: Google (google_* fields), Booking / Airbnb (booking_* / airbnb_* fields,
// else taken from review_links). Returns [{key, label, value, count, url}] with only the known ones.
export const ratingsOf = (z) => {
  const links = Array.isArray(z?.review_links) ? z.review_links.filter((l) => l && l.url) : [];
  const link = (re) => links.find((l) => re.test(l.site || "") || re.test(l.url || ""));
  const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const out = [];
  const g = num(z?.google_rating);
  if (g !== null)
    out.push({
      key: "google",
      label: "Google",
      value: g.toFixed(1),
      count: num(z.google_review_count),
      url: z.google_reviews_url || link(/google/i)?.url || null,
    });
  for (const [key, label, re, fmt] of [
    ["booking", "Booking", /booking/i, (v) => (v >= 10 ? "10" : v.toFixed(1))],
    ["airbnb", "Airbnb", /airbnb/i, (v) => String(v)],
  ]) {
    const l = link(re);
    const v = num(z?.[`${key}_rating`]) ?? num(l?.rating);
    if (v === null) continue;
    out.push({ key, label, value: fmt(v), count: num(z?.[`${key}_review_count`]) ?? num(l?.count), url: l?.url || null });
  }
  return out;
};

export const mapsLink = (z) => {
  const q = [z.town, z.region].filter(Boolean).join(", ");
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.region.country ? `${q}, ${config.region.country}` : q)}`
    : null;
};

// Most common check_in/check_out pair across records
export const searchDates = (items) => {
  const counts = new Map();
  for (const z of items) {
    if (!z.check_in && !z.check_out) continue;
    const k = `${z.check_in || ""}|${z.check_out || ""}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = null,
    bestN = 0;
  for (const [k, n] of counts)
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  if (!best) return null;
  const [ci, co] = best.split("|");
  return { check_in: ci, check_out: co };
};

// locale is fixed at load time, so labels can be translated here
export const AVAILABILITY = {
  verified: { label: t("Availability verified"), cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  unverified: { label: t("Availability not verified"), cls: "bg-amber-50 text-amber-800 border-amber-200" },
  unavailable: { label: t("Not available"), cls: "bg-red-100 text-red-700 border-red-200" },
};

export const featureBadges = (z) => {
  const b = [];
  if (z.jacuzzi_indoor) b.push({ key: "ji", label: t("Indoor jacuzzi") });
  if (z.jacuzzi_outdoor) b.push({ key: "jo", label: t("Outdoor jacuzzi") });
  if (z.has_kitchen) b.push({ key: "k", label: t("Kitchen") });
  if (z.has_bbq) b.push({ key: "bbq", label: t("BBQ") });
  if (z.has_view) b.push({ key: "v", label: t("View") });
  return b;
};

// ---------- phones ----------
const CC = String(config.region.phone_country_code || "");
const MOBILE = (config.region.mobile_prefixes || []).map(String);
// Digits -> international digits without "+" (e.g. "050-1234567" -> "972501234567" when phone_country_code is 972).
export const toIntl = (digits) => {
  let d = String(digits || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (CC && d.startsWith("0")) d = CC + d.slice(1);
  if (d.length < 8 || d.length > 15) return null;
  return d;
};
// All phone-like tokens in a free-text field, normalized to international digits (972...).
export const phonesOf = (text) => {
  if (!text) return [];
  const out = [];
  for (const m of String(text).matchAll(/\+?\d[\d\s-]{6,}\d/g)) {
    let d = m[0].replace(/\D/g, "");
    d = toIntl(d);
    if (!d) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
};
// WhatsApp needs a mobile number. With region.mobile_prefixes set (e.g. ["5"] for Israel), landlines are skipped;
// without it every number counts as mobile.
export const isMobileIntl = (d) => {
  if (!d) return false;
  if (!CC || !MOBILE.length) return true;
  return d.startsWith(CC) && MOBILE.some((p) => d.slice(CC.length).startsWith(p));
};
export const waNumberOf = (z) => [...phonesOf(z?.whatsapp), ...phonesOf(z?.phone)].find(isMobileIntl) || null;
export const telNumberOf = (z) => phonesOf(z?.phone)[0] || phonesOf(z?.whatsapp)[0] || null;
export const telHref = (d) => (d ? `tel:+${d}` : null);
export const displayPhone = (d) => {
  if (!d) return "";
  if (!CC || !d.startsWith(CC)) return "+" + d;
  const local = "0" + d.slice(CC.length);
  return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3)}` : `${local.slice(0, 2)}-${local.slice(2)}`;
};

const longDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const jacuzziQuestion = (z) => {
  if (z.jacuzzi_indoor && z.jacuzzi_outdoor) return t("Are both the indoor and the outdoor jacuzzi private, just for us?");
  if (z.jacuzzi_indoor) return t("Is the indoor jacuzzi private, just for us?");
  if (z.jacuzzi_outdoor) return t("Is the outdoor jacuzzi private, just for us (not shared)?");
  return t("Is there a private jacuzzi (indoor or outdoor) just for us?");
};

// Ready-made availability question for WhatsApp. Built from trip.config.json; the user sends it themselves.
export const availabilityMessage = (z) => {
  const name = z.unit && z.unit.length <= 25 ? `${z.name} - ${z.unit}` : z.name;
  const { adults = 2, children = 0, check_in, check_out } = config.trip;
  const guests = children ? t("{a} adults and {c} children", { a: adults, c: children }) : t("{a} adults", { a: adults });
  return [
    t("Hi, we saw {name} and would like to check availability for {guests} from {from} to {to} ({nights} nights).", {
      name,
      guests,
      from: longDate(check_in),
      to: longDate(check_out),
      nights: NIGHTS ?? "?",
    }),
    "1. " + t("Is it available on these dates?"),
    "2. " + t("What is the final price for the whole stay, including taxes and all fees?"),
    "3. " + jacuzziQuestion(z),
    "4. " + t("Is there an equipped kitchen or kitchenette?"),
    "5. " + t("Is there a BBQ we can use?"),
    "6. " + t("Is the place private and not overlooked by neighbours or other guests?"),
    "7. " + t("What is the cancellation policy?"),
    t("Thank you!"),
  ].join("\n");
};

export const waAvailabilityLink = (z) => {
  const n = waNumberOf(z);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(availabilityMessage(z))}` : null;
};

// ---------- price ----------
export const finalPrice = (z) =>
  typeof z?.price_total === "number" ? z.price_total : typeof z?.price_estimate === "number" ? z.price_estimate : null;
export const perNight = (z) => {
  if (typeof z?.price_per_night === "number") return z.price_per_night;
  const f = finalPrice(z);
  return f === null || !NIGHTS ? null : Math.round(f / NIGHTS);
};
// Change between the last two price_history entries (by date): { diff, up } or null
export const priceChange = (z) => {
  const h = (Array.isArray(z?.price_history) ? z.price_history : [])
    .filter((e) => e && e.date && typeof e.total === "number")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (h.length < 2) return null;
  const diff = h[h.length - 1].total - h[h.length - 2].total;
  return diff ? { diff, up: diff > 0, prev: h[h.length - 2].total } : null;
};

// ---------- drive ----------
export const ORIGIN = { name: config.origin.name, lat: config.origin.lat, lng: config.origin.lng };
export const formatDrive = (min) => {
  if (typeof min !== "number" || Number.isNaN(min)) return null;
  const m = Math.round(min);
  if (m < 60) return t("~{m} min", { m });
  return t("~{h}:{mm} h", { h: Math.floor(m / 60), mm: String(m % 60).padStart(2, "0") });
};
export const driveText = (z) => {
  const tm = formatDrive(z?.drive_minutes);
  if (!tm) return null;
  const from = config.origin.name ? t("{time} from {origin}", { time: tm, origin: config.origin.name }) : tm;
  return from + (typeof z.drive_km === "number" ? ` · ${t("{km} km", { km: Math.round(z.drive_km) })}` : "");
};

// ---------- status ----------
export const isSoldOut = (z) => z?.is_active === false || z?.availability_status === "unavailable";

// "New": added after the baseline (last visit, or now - 3 days for first-time visitors)
const LAST_VISIT_KEY = "zimmer_last_visit";
const BASELINE_KEY = "zimmer_new_baseline";
export const newBaseline = () => {
  try {
    const kept = sessionStorage.getItem(BASELINE_KEY);
    if (kept) return Number(kept);
    const last = Number(localStorage.getItem(LAST_VISIT_KEY));
    const base = last > 0 ? last : Date.now() - 3 * 24 * 3600 * 1000;
    sessionStorage.setItem(BASELINE_KEY, String(base));
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    return base;
  } catch (e) {
    return Date.now() - 3 * 24 * 3600 * 1000;
  }
};
export const createdMs = (z) => {
  const c = z?.added_at || z?.found_date;
  if (!c) return null;
  const s = String(c);
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); // dates without a zone are UTC
  return Number.isNaN(ms) ? null : ms;
};
export const isNewSince = (z, baseline) => {
  const t = createdMs(z);
  return t !== null && t > baseline;
};
