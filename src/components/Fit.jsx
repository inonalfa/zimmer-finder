import { Sparkles, Check, AlertTriangle, Minus } from "lucide-react";
import { t } from "@/i18n";
import { hasFit, reasonText, fitTone } from "@/lib/fit";

export function FitBadge({ z, className = "" }) {
  if (!hasFit(z)) return null;
  const s = Math.round(z.fit_score);
  return (
    <span
      data-testid="fit-badge"
      title={t("How well this fits your taste, learned from your past trips")}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow ${fitTone(s)} ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" /> {t("Fits you {score}%", { score: s })}
    </span>
  );
}

const ICON = { match: Check, warn: AlertTriangle, miss: Minus };
const TONE = { match: "text-emerald-700", warn: "text-amber-700", miss: "text-stone-500" };

export function FitReasons({ z, max = Infinity, compact = false }) {
  const reasons = (Array.isArray(z?.fit_reasons) ? z.fit_reasons : []).slice(0, max);
  if (!reasons.length) return null;
  return (
    <ul data-testid="fit-reasons" className={`flex flex-col ${compact ? "gap-0.5 text-xs" : "gap-1.5 text-sm"}`}>
      {reasons.map((r, i) => {
        const Icon = ICON[r.kind] || Minus;
        return (
          <li key={i} className={`flex items-start gap-1.5 ${TONE[r.kind] || ""}`}>
            <Icon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} mt-0.5 shrink-0`} />
            <span>{reasonText(r)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function FitSection({ z }) {
  if (!hasFit(z)) return null;
  return (
    <section data-testid="fit-section" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-stone-800">{t("Why it fits you")}</h3>
        <FitBadge z={z} />
      </div>
      <FitReasons z={z} />
      <p className="mt-2 text-xs text-stone-500">{t("Based on how you voted on past trips. See Your taste.")}</p>
    </section>
  );
}
