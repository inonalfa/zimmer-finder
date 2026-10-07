import { MessageCircle, Phone, ExternalLink, Car, BadgeCheck, CircleHelp, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import {
  waAvailabilityLink,
  telNumberOf,
  telHref,
  displayPhone,
  formatPrice,
  priceChange,
  driveText,
  formatDate,
} from "@/lib/zimmer-utils";
import { t } from "@/i18n";

const stop = (e) => e.stopPropagation();

export function MatchBadge({ className = "", size = "sm" }) {
  const big = size === "lg";
  return (
    <span
      data-testid="match-badge"
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-l from-pink-500 to-rose-600 font-bold text-white shadow-md ring-2 ring-white/80 ${big ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"} ${className}`}
      title={t("At least two people liked it and nobody disliked it")}
    >
      💞 {t("Match")}
    </span>
  );
}

export function NewBadge({ className = "" }) {
  return (
    <span
      data-testid="new-badge"
      className={`inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-1 text-xs font-bold text-white shadow ${className}`}
    >
      <Sparkles className="h-3 w-3" /> {t("New")}
    </span>
  );
}

export function PriceStatusChip({ z, className = "" }) {
  const ok = z.price_status === "verified";
  if (!z.price_status) return null;
  return (
    <span
      data-testid="price-status"
      data-status={z.price_status}
      title={z.price_note || ""}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"} ${className}`}
    >
      {ok ? <BadgeCheck className="h-3 w-3" /> : <CircleHelp className="h-3 w-3" />}
      {ok ? t("Verified price") : t("Estimated price")}
    </span>
  );
}

export function CheckedAt({ z, className = "" }) {
  if (!z.price_checked_at) return <span className={`text-[11px] text-stone-400 ${className}`}>{t("Not checked for the dates")}</span>;
  return (
    <span data-testid="price-checked" className={`text-[11px] text-stone-500 ${className}`}>
      {t("Last checked: {date}", { date: formatDate(z.price_checked_at) })}
    </span>
  );
}

export function PriceChangeTag({ z, className = "" }) {
  const c = priceChange(z);
  if (!c) return null;
  const Icon = c.up ? TrendingUp : TrendingDown;
  return (
    <span
      data-testid="price-change"
      title={t("Previous price: {price}", { price: formatPrice(c.prev) })}
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${c.up ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" /> {c.up ? "▲" : "▼"} {formatPrice(Math.abs(c.diff))}
    </span>
  );
}

export function DriveTag({ z, className = "" }) {
  const t = driveText(z);
  if (!t) return null;
  return (
    <span data-testid="drive" className={`inline-flex items-center gap-1 text-xs text-stone-600 ${className}`}>
      <Car className="h-3.5 w-3.5 shrink-0 text-sky-600" /> {t}
    </span>
  );
}

// Availability question to the host: WhatsApp (mobile numbers) with a prefilled message,
// tel link for landline-only, or a secondary "no number - to the site" link.
export function WhatsAppAsk({ z, compact = false, className = "" }) {
  const wa = waAvailabilityLink(z);
  const tel = telNumberOf(z);
  const site = z.listing_url || z.website_url || z.alt_listing_url || null;
  const base = `inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors ${compact ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-base"}`;
  if (wa) {
    return (
      <a
        data-testid="wa-ask"
        data-kind="wa"
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        className={`${base} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 ${className}`}
      >
        <MessageCircle className="h-4 w-4" /> {compact ? t("Ask on WhatsApp") : t("Ask about availability on WhatsApp")}
      </a>
    );
  }
  if (tel) {
    return (
      <a
        data-testid="wa-ask"
        data-kind="tel"
        href={telHref(tel)}
        onClick={stop}
        title={t("Landline - no WhatsApp")}
        className={`${base} border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ${className}`}
      >
        <Phone className="h-4 w-4" /> {compact ? t("Landline - call") : t("Landline - call ({phone})", { phone: displayPhone(tel) })}
      </a>
    );
  }
  if (site) {
    return (
      <a
        data-testid="wa-ask"
        data-kind="none"
        href={site}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        title={t("No host phone number found")}
        className={`${base} border border-dashed border-stone-300 bg-stone-50 text-stone-500 hover:bg-stone-100 ${className}`}
      >
        <ExternalLink className="h-4 w-4" /> {t("No number - website")}
      </a>
    );
  }
  return (
    <span
      data-testid="wa-ask"
      data-kind="none"
      aria-disabled="true"
      className={`${base} cursor-not-allowed border border-dashed border-stone-200 bg-stone-50 text-stone-400 ${className}`}
    >
      {t("No number")}
    </span>
  );
}
