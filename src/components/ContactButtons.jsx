import { Phone, Globe } from "lucide-react";
import { telNumberOf, telHref, siteLink, waNumberOf } from "@/lib/zimmer-utils";
import { WhatsAppAsk } from "./ZimmerExtras";
import { t } from "@/i18n";

const base = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

// WhatsApp availability question (or tel / "no number" fallback) + call + site
export default function ContactButtons({ z, size = "sm" }) {
  const tel = telNumberOf(z);
  const web = siteLink(z);
  const stop = (e) => e.stopPropagation();
  const lg = size === "lg";
  const pad = lg ? " px-4 py-2.5 text-base" : "";
  const waIsMobile = !!waNumberOf(z);
  const fallback = z.listing_url || z.website_url || z.alt_listing_url || null; // used by WhatsAppAsk when there is no phone
  return (
    <div className="flex flex-wrap gap-2" onClick={stop}>
      <WhatsAppAsk z={z} compact={!lg} />
      {tel && waIsMobile && (
        <a href={telHref(tel)} className={`${base}${pad} bg-stone-800 text-white hover:bg-stone-700`} aria-label={t("Call")}>
          <Phone className="w-4 h-4" /> {lg ? t("Call") : ""}
        </a>
      )}
      {web && (tel || (lg && web !== fallback)) && (
        <a
          href={web}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base}${pad} bg-orange-100 text-orange-900 hover:bg-orange-200`}
        >
          <Globe className="w-4 h-4" /> {t("Website")}
        </a>
      )}
    </div>
  );
}
