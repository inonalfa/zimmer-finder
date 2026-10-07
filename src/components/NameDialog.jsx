import { useEffect, useRef, useState } from "react";
import { UserRound, X } from "lucide-react";
import { MAX_NAME, cleanName } from "@/lib/votes";
import { t, dir } from "@/i18n";

export default function NameDialog({ initial = "", onSave, onClose }) {
  const [name, setName] = useState(initial);
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  const v = cleanName(name);
  const submit = (e) => {
    e.preventDefault();
    if (v) onSave(v.slice(0, MAX_NAME));
  };
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        dir={dir}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
          aria-label={t("Close")}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
          <UserRound className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">{t("What's your name?")}</h2>
        <p className="mt-1 text-sm text-stone-500">
          {t("Your name is shown next to your votes and everyone can see it. No sign-up needed.")}
        </p>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder={t("e.g. Dana")}
          className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-300"
          autoComplete="nickname"
          enterKeyHint="done"
        />
        <div className="mt-1 text-left text-xs text-stone-400" dir="ltr">
          {[...v].length}/{MAX_NAME}
        </div>
        <button
          type="submit"
          disabled={!v}
          className="mt-3 w-full rounded-xl bg-orange-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {t("Save")}
        </button>
      </form>
    </div>
  );
}
