import { useEffect } from "react";
import {
  X,
  AlertTriangle,
  ExternalLink,
  Mail,
  MapPin,
  Bath,
  Waves,
  CookingPot,
  Flame,
  Mountain,
  ShieldCheck,
  Coffee,
  Trees,
  Star,
  CalendarDays,
  Wallet,
  Phone,
  Images,
  FileText,
  Sparkles,
  ThumbsUp,
  Info,
  Map,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Link2,
} from "lucide-react";
import ContactButtons from "./ContactButtons";
import RatingBadges from "./RatingBadges";
import Gallery from "./Gallery";
import AiSummary from "./AiSummary";
import VoteBar from "./VoteBar";
import {
  formatPrice,
  formatDate,
  AVAILABILITY,
  toTel,
  firstPhone,
  phoneNote,
  imagesOf,
  thumbsOf,
  mapsLink,
  ratingsOf,
  finalPrice,
  perNight,
  driveText,
  waNumberOf,
  displayPhone,
  waAvailabilityLink,
  isSoldOut,
} from "@/lib/zimmer-utils";
import { MatchBadge, NewBadge, PriceStatusChip, CheckedAt, PriceChangeTag, DriveTag } from "./ZimmerExtras";
import { t } from "@/i18n";
import { NIGHTS } from "@/config";

function Section({ icon: Icon, title, children, id }) {
  return (
    <section id={id} className="scroll-mt-16">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-stone-900">
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-stone-50 px-3 py-2.5">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="break-words whitespace-pre-line text-sm font-medium text-stone-800">{children}</dd>
    </div>
  );
}

const ext = (url, text) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all text-orange-700 hover:underline"
    >
      {text || url} <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  ) : null;

function Chip({ icon: Icon, label, on }) {
  if (on === null || on === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${
        on ? "border-orange-200 bg-orange-50 text-orange-900" : "border-stone-200 bg-stone-50 text-stone-400"
      }`}
      title={on ? label : t("No {feature}", { feature: label })}
    >
      <Icon className={`h-[18px] w-[18px] ${on ? "text-orange-600" : "text-stone-300"}`} />
      <span className={on ? "" : "line-through decoration-stone-300"}>{label}</span>
    </span>
  );
}

function Note({ icon: Icon, title, children, tone = "stone" }) {
  if (!children) return null;
  const tones = {
    stone: "border-stone-200 bg-stone-50",
    green: "border-emerald-100 bg-emerald-50/70",
    red: "border-red-100 bg-red-50",
    amber: "border-amber-200 bg-amber-50/70",
  };
  const head = { stone: "text-stone-800", green: "text-emerald-900", red: "text-red-800", amber: "text-amber-900" };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <h4 className={`mb-1.5 flex items-center gap-1.5 text-sm font-bold ${head[tone]}`}>
        {Icon && <Icon className="h-4 w-4" />} {title}
      </h4>
      <div className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{children}</div>
    </div>
  );
}

const availIcon = { verified: CheckCircle2, unverified: HelpCircle, unavailable: XCircle };

export default function ZimmerDetail({ z, onClose, voteInfo, onVote, myName, match = false, isNew = false }) {
  const images = imagesOf(z);
  const thumbs = thumbsOf(z);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const avail = AVAILABILITY[z.availability_status];
  const AvailIcon = availIcon[z.availability_status] || HelpCircle;
  const reviewLinks = Array.isArray(z.review_links) ? z.review_links.filter((l) => l && l.url) : [];
  const hasReviews =
    z.review_summary ||
    z.google_review_summary ||
    z.review_red_flags ||
    reviewLinks.length ||
    typeof z.google_rating === "number" ||
    z.rating;
  const place = [z.region, z.town].filter(Boolean).join(" · ");
  const price = formatPrice(finalPrice(z));
  const night = formatPrice(perNight(z));
  const soldOut = isSoldOut(z);
  const map = mapsLink(z);
  const phone = firstPhone(z.phone);
  const phoneTxt = phoneNote(z.phone);
  const waNum = waNumberOf(z);

  const features = [
    { key: "pj", icon: ShieldCheck, label: t("Private jacuzzi"), on: z.has_private_jacuzzi },
    { key: "ji", icon: Bath, label: t("Indoor jacuzzi"), on: z.jacuzzi_indoor },
    { key: "jo", icon: Trees, label: t("Outdoor jacuzzi"), on: z.jacuzzi_outdoor },
    { key: "k", icon: CookingPot, label: t("Kitchen"), on: z.has_kitchen },
    { key: "bbq", icon: Flame, label: t("BBQ"), on: z.has_bbq },
    { key: "v", icon: Mountain, label: t("View"), on: z.has_view },
    { key: "p", icon: Waves, label: t("Pool"), on: z.has_pool },
    { key: "b", icon: Coffee, label: t("Breakfast"), on: z.breakfast ? true : null },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-stone-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-[#fffdf9] shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={z.name}
      >
        {/* sticky top bar */}
        <div
          className="flex items-center gap-3 border-b border-stone-200/70 bg-white/90 px-4 py-2.5 backdrop-blur"
          style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
        >
          <button onClick={onClose} className="rounded-full bg-stone-100 p-2 hover:bg-stone-200" aria-label={t("Close")}>
            <X className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-stone-700">{z.name}</span>
          {typeof z.score === "number" && (
            <span className="ms-auto shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-800">
              {t("Rank #{n}", { n: z.score })}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-7 p-4 pb-10 sm:p-7">
            {/* HERO */}
            <header className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  {(match || isNew) && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {match && <MatchBadge size="lg" />}
                      {isNew && <NewBadge />}
                    </div>
                  )}
                  <h2 className="text-2xl font-extrabold leading-tight text-stone-900 sm:text-3xl">{z.name}</h2>
                  {z.unit && <p className="mt-0.5 text-stone-500">{z.unit}</p>}
                  {z.name_en && (
                    <p className="text-sm text-stone-400" dir="ltr" style={{ textAlign: "right" }}>
                      {z.name_en}
                    </p>
                  )}
                  {place && (
                    <p className="mt-2 flex items-center gap-1.5 text-stone-700">
                      <MapPin className="h-4 w-4 shrink-0 text-orange-600" /> {place}
                    </p>
                  )}
                  <DriveTag z={z} className="mt-1 text-sm" />
                  {ratingsOf(z).length > 0 ? (
                    <RatingBadges z={z} className="mt-2" />
                  ) : z.rating ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {z.rating}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div
                  data-testid="detail-price"
                  className="flex flex-col gap-1 self-start rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white px-4 py-2.5 sm:items-center sm:py-3 sm:text-center"
                >
                  <div className="flex items-center gap-2 sm:justify-center">
                    <span className="text-3xl font-extrabold text-orange-700">{price || t("Price unknown")}</span>
                    <PriceChangeTag z={z} />
                  </div>
                  <div className="text-xs text-stone-500">
                    {t("Total for {nights} nights incl. taxes and fees", { nights: NIGHTS ?? "?" })}
                    {night && <> · {t("{price} per night", { price: night })}</>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-center">
                    <PriceStatusChip z={z} />
                    <CheckedAt z={z} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {avail && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${avail.cls}`}>
                    <AvailIcon className="h-3.5 w-3.5" /> {avail.label}
                  </span>
                )}
                {z.within_budget === true && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {t("Within budget")}
                  </span>
                )}
                {z.within_budget === false && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    {t("Over budget")}
                  </span>
                )}
                {z.jacuzzi_indoor && z.jacuzzi_outdoor && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-900">
                    {t("Indoor + outdoor jacuzzi")}
                  </span>
                )}
                {soldOut && (
                  <span className="rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white">{t("Already booked")}</span>
                )}
              </div>
            </header>

            {/* AI SUMMARY (collapsed by default) - first content block */}
            <AiSummary text={z.summary} />

            {/* quick actions: contact + shared votes */}
            <div className="flex flex-col gap-3">
              <ContactButtons z={z} size="lg" />
              <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm font-bold text-stone-800">
                  <ThumbsUp className="h-4 w-4 text-rose-500" /> {t("What do you think?")}
                  {myName && <span className="font-normal text-stone-400">{t("(voting as {name})", { name: myName })}</span>}
                </div>
                <VoteBar info={voteInfo} onVote={onVote} full myName={myName} />
              </div>
            </div>

            {images.length > 0 && (
              <Section icon={Images} title={t("Gallery ({n})", { n: images.length })}>
                <Gallery images={images} thumbs={thumbs} alt={z.name} />
              </Section>
            )}

            {z.description && (
              <Section icon={FileText} title={t("Description")}>
                <p className="whitespace-pre-line leading-relaxed text-stone-700">{z.description}</p>
              </Section>
            )}

            <Section icon={Sparkles} title={t("Amenities")}>
              <div className="flex flex-wrap gap-2">
                {features.map(({ key, ...f }) => (
                  <Chip key={key} {...f} />
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Note icon={ShieldCheck} title={t("Privacy")}>
                  {z.privacy_notes}
                </Note>
                <Note icon={Coffee} title={t("Breakfast")}>
                  {z.breakfast}
                </Note>
              </div>
            </Section>

            <Section icon={Wallet} title={t("Price and availability")}>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Row label={t("Final price ({nights} nights, incl. taxes)", { nights: NIGHTS ?? "?" })}>{price}</Row>
                <Row label={t("Per night")}>{night}</Row>
                <Row label={t("Price at source")}>
                  {typeof z.price_original === "number" && z.price_original !== finalPrice(z) ? formatPrice(z.price_original) : null}
                </Row>
                <Row label={t("Price status")}>
                  {z.price_status === "verified" ? t("Verified") : z.price_status === "estimated" ? t("Estimated") : null}
                </Row>
                <Row label={t("Last checked")}>{formatDate(z.price_checked_at)}</Row>
                <Row label={t("Within budget")}>{z.within_budget === true ? t("Yes") : z.within_budget === false ? t("No") : null}</Row>
                <Row label={t("Check-in")}>{formatDate(z.check_in)}</Row>
                <Row label={t("Check-out")}>{formatDate(z.check_out)}</Row>
              </dl>
              <div className="mt-2 grid gap-2">
                {(avail || z.availability_source) && (
                  <Note
                    icon={CalendarDays}
                    title={avail ? t("Availability: {status}", { status: avail.label }) : t("Availability")}
                    tone={z.availability_status === "verified" ? "green" : z.availability_status === "unavailable" ? "red" : "amber"}
                  >
                    {z.availability_source || avail?.label}
                  </Note>
                )}
                <Note
                  icon={Wallet}
                  title={
                    z.price_status === "verified" ? t("How the price was computed (verified)") : t("How the price was computed (estimated)")
                  }
                  tone={z.price_status === "verified" ? "green" : "amber"}
                >
                  {z.price_note}
                </Note>
                {Array.isArray(z.price_history) && z.price_history.length > 1 && (
                  <Note icon={Info} title={t("Price history")}>
                    {z.price_history.map((h) => `${formatDate(h.date)}: ${formatPrice(h.total)}`).join("\n")}
                  </Note>
                )}
                <Note icon={Info} title={t("Price notes")}>
                  {z.price_notes}
                </Note>
              </div>
            </Section>

            <Section icon={Phone} title={t("Contact")}>
              <ContactButtons z={z} size="lg" />
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Row label={t("Phone")}>
                  {phone && (
                    <span className="flex flex-col gap-0.5">
                      <a
                        href={toTel(phone)}
                        className="font-semibold text-orange-700 hover:underline"
                        dir="ltr"
                        style={{ textAlign: "right" }}
                      >
                        {phone}
                      </a>
                      {phoneTxt && <span className="text-xs font-normal text-stone-500">{phoneTxt}</span>}
                    </span>
                  )}
                </Row>
                <Row label="WhatsApp">
                  {waNum
                    ? ext(waAvailabilityLink(z), displayPhone(waNum) + " " + t("(with a ready-made message)"))
                    : phone
                      ? t("Landline - no WhatsApp")
                      : null}
                </Row>
                <Row label={t("Email")}>
                  {z.email && (
                    <a href={`mailto:${z.email}`} className="inline-flex items-center gap-1 break-all text-orange-700 hover:underline">
                      <Mail className="h-3 w-3" />
                      {z.email}
                    </a>
                  )}
                </Row>
                <Row label={t("Website")}>{ext(z.website_url)}</Row>
                <Row label={t("Listing")}>{ext(z.listing_url)}</Row>
                <Row label={t("Alternative listing")}>{ext(z.alt_listing_url)}</Row>
              </dl>
            </Section>

            {hasReviews && (
              <Section icon={Star} title={t("Reviews")}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {z.rating && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                        <span className="font-semibold">{z.rating}</span>
                        {z.rating_source && (
                          <span className="block text-xs text-stone-500">{t("Source: {source}", { source: z.rating_source })}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <RatingBadges z={z} />
                  <Note icon={ThumbsUp} title={t("What guests say")} tone="green">
                    {z.review_summary}
                  </Note>
                  <Note icon={Star} title={t("What Google reviews say")} tone="amber">
                    {z.google_review_summary}
                  </Note>
                  <Note icon={AlertTriangle} title={t("Complaints and red flags")} tone="red">
                    {z.review_red_flags}
                  </Note>
                  {z.google_reviews_url_note && (
                    <p className="text-xs leading-relaxed text-stone-500">Google: {z.google_reviews_url_note}</p>
                  )}
                  {reviewLinks.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {reviewLinks.map((l, i) => (
                        <li key={l.url + i}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm hover:border-orange-300 hover:bg-orange-50"
                          >
                            <span className="flex items-center gap-2 font-medium text-stone-800">
                              <Link2 className="h-4 w-4 text-stone-400" />
                              {l.site || t("Reviews")}
                            </span>
                            <span className="flex items-center gap-2 text-stone-500">
                              {typeof l.rating === "number" && <span className="font-semibold text-stone-800">★ {l.rating}</span>}
                              {typeof l.count === "number" && <span>({l.count})</span>}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>
            )}

            {(place || map) && (
              <Section icon={Map} title={t("Location")}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="text-sm text-stone-700">
                    {z.town && <div className="text-base font-semibold text-stone-900">{z.town}</div>}
                    {z.region && <div>{z.region}</div>}
                    {driveText(z) && (
                      <div className="mt-1 text-sky-800">
                        {driveText(z)} {t("(no traffic)")}
                      </div>
                    )}
                    {z.geo_note && <div className="mt-1 text-xs text-stone-400">{z.geo_note}</div>}
                  </div>
                  {map && (
                    <a
                      href={map}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      <MapPin className="h-4 w-4" /> {t("Open in Google Maps")}
                    </a>
                  )}
                </div>
              </Section>
            )}

            <Section icon={Info} title={t("More info")}>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Row label={t("Rank in the list (1 = best)")}>{typeof z.score === "number" ? String(z.score) : null}</Row>
                <Row label={t("Found on")}>{formatDate(z.found_date)}</Row>
                <Row label={t("Last checked")}>{formatDate(z.last_checked)}</Row>
                <Row label={t("Active")}>{z.is_active === false ? t("No") : t("Yes")}</Row>
              </dl>
              {z.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-stone-50 p-3 text-sm text-stone-700">{z.notes}</p>}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
