import { MapPin, CheckCircle2, XCircle, Heart, ThumbsDown } from "lucide-react";
import ImageCarousel from "./ImageCarousel";
import ContactButtons from "./ContactButtons";
import RatingBadges from "./RatingBadges";
import VoteBar from "./VoteBar";
import { formatPrice, imagesOf, thumbsOf, featureBadges, finalPrice, perNight } from "@/lib/zimmer-utils";
import { MatchBadge, NewBadge, PriceStatusChip, CheckedAt, PriceChangeTag, DriveTag } from "./ZimmerExtras";
import { t } from "@/i18n";
import { FitBadge, FitReasons } from "./Fit";
import { NIGHTS } from "@/config";

export default function ZimmerCard({ z, onOpen, voteInfo, onVote, dimmed = false, match = false, isNew = false, soldOut = false }) {
  const price = formatPrice(finalPrice(z));
  const night = formatPrice(perNight(z));
  const place = [z.region, z.town].filter(Boolean).join(" · ");
  const images = imagesOf(z);
  const thumbs = thumbsOf(z);
  const mine = voteInfo.mine;
  const ring = match
    ? "ring-2 ring-pink-500 border-pink-200"
    : mine === "like"
      ? "ring-2 ring-rose-400 border-rose-200"
      : mine === "unlike"
        ? "border-stone-300"
        : "border-stone-200/70";
  return (
    <article
      data-testid="zimmer-card"
      data-slug={z.slug}
      data-match={match ? "1" : "0"}
      onClick={() => onOpen(z)}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-xl ${ring} ${
        dimmed || soldOut ? "opacity-60 saturate-[.35] hover:opacity-100 hover:saturate-100" : ""
      }`}
    >
      <div className="relative">
        <ImageCarousel images={images} thumbs={thumbs} alt={z.name} className="aspect-[4/3] w-full" />
        {typeof z.score === "number" && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-orange-700 shadow">
            #{z.score}
          </span>
        )}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-end gap-1.5">
          {match && <MatchBadge size="lg" />}
          <FitBadge z={z} />
          {isNew && !soldOut && <NewBadge />}
          {soldOut && <span className="rounded-full bg-stone-800/85 px-2.5 py-1 text-xs font-semibold text-white">{t("Booked")}</span>}
          {mine === "like" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white shadow">
              <Heart className="h-3.5 w-3.5" fill="currentColor" /> {t("You liked")}
            </span>
          )}
          {mine === "unlike" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-800/90 px-2.5 py-1 text-xs font-semibold text-white shadow">
              <ThumbsDown className="h-3.5 w-3.5" fill="currentColor" /> {t("You disliked")}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 className="text-lg font-bold leading-tight text-stone-900">
            {z.name}
            {z.unit && <span className="font-normal text-stone-500"> - {z.unit}</span>}
          </h2>
          {place && (
            <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {place}
            </p>
          )}
          <RatingBadges z={z} className="mt-2" />
        </div>
        <FitReasons z={z} max={2} compact />
        <div className="flex flex-col gap-1" data-testid="card-price">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-extrabold text-orange-700">{price || t("Price unknown")}</span>
                <PriceChangeTag z={z} />
              </div>
              <div className="text-xs text-stone-500">
                {t("Total for {nights} nights incl. taxes", { nights: NIGHTS ?? "?" })}
                {night && <> · {t("{price} per night", { price: night })}</>}
              </div>
            </div>
            {z.within_budget === false && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">{t("Over budget")}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PriceStatusChip z={z} />
            <CheckedAt z={z} />
          </div>
          <DriveTag z={z} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {featureBadges(z).map((b) => (
            <span
              key={b.key}
              className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-900"
            >
              {b.label}
            </span>
          ))}
          {z.availability_status === "verified" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> {t("Availability verified")}
            </span>
          )}
          {z.availability_status === "unavailable" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              <XCircle className="h-3 w-3" /> {t("Not available")}
            </span>
          )}
        </div>
        <div className="border-t border-stone-100 pt-3">
          <VoteBar info={voteInfo} onVote={onVote} />
        </div>
        <div className="mt-auto pt-1">
          <ContactButtons z={z} />
        </div>
      </div>
    </article>
  );
}
