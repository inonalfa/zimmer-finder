import { Star } from "lucide-react";
import { t } from "@/i18n";

export default function GoogleRating({ z, className = "" }) {
  if (typeof z.google_rating !== "number") return null;
  const content = (
    <>
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="font-semibold">{z.google_rating.toFixed(1)}</span>
      {typeof z.google_review_count === "number" && (
        <span className="text-stone-500">({t("{n} reviews", { n: z.google_review_count.toLocaleString("en-US") })})</span>
      )}
      <span className="text-stone-400 text-xs">Google</span>
    </>
  );
  const cls = `inline-flex items-center gap-1 text-sm ${className}`;
  return z.google_reviews_url ? (
    <a
      href={z.google_reviews_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${cls} hover:underline`}
      title={t("Google reviews")}
    >
      {content}
    </a>
  ) : (
    <span className={cls}>{content}</span>
  );
}
