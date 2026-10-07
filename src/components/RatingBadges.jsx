import { Star } from "lucide-react";
import { ratingsOf } from "@/lib/zimmer-utils";
import { t } from "@/i18n";

const STYLE = {
  google: "border-amber-200 bg-amber-50 text-stone-800",
  booking: "border-blue-200 bg-blue-50 text-blue-900",
  airbnb: "border-rose-200 bg-rose-50 text-rose-900",
};

// Compact rating pills (Google / Booking / Airbnb). Each links to its reviews page when known.
export default function RatingBadges({ z, className = "", size = "sm" }) {
  const items = ratingsOf(z);
  if (!items.length) return null;
  const pad = size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="rating-badges">
      {items.map((r) => {
        const body = (
          <>
            {r.key !== "booking" && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            <span className="font-bold tabular-nums">{r.value}</span>
            {typeof r.count === "number" && <span className="tabular-nums opacity-70">({r.count.toLocaleString("en-US")})</span>}
            <span className="opacity-70">{r.label}</span>
          </>
        );
        const cls = `inline-flex items-center gap-1 rounded-full border font-medium ${pad} ${STYLE[r.key]}`;
        return r.url ? (
          <a
            key={r.key}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${cls} hover:brightness-95`}
            title={t("Reviews on {site}", { site: r.label })}
          >
            {body}
          </a>
        ) : (
          <span key={r.key} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
