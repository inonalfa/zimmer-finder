import { useId, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { t } from "@/i18n";

// Collapsible AI summary, collapsed by default. Hidden when there is no summary.
export default function AiSummary({ text, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!text || !String(text).trim()) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 via-white to-orange-50/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-bold text-stone-900">{t("AI summary")}</span>
          <span className="block text-xs text-stone-500">
            {open ? t("Tap to close") : t("A short digest of everything we found - tap to open")}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-violet-700 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-[15px] leading-relaxed text-stone-800">{text}</p>
          <p className="px-4 pb-3 text-[11px] text-stone-400">
            {t("Written automatically from the collected data. Double-check anything important with the host.")}
          </p>
        </div>
      </div>
    </section>
  );
}
