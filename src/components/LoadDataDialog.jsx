import { useRef, useState } from "react";
import { FileUp, Link2, ClipboardPaste, X } from "lucide-react";
import { loadFromUrl, parseRecords } from "@/storage/data";
import { t, dir } from "@/i18n";

// Viewer mode: show results an agent produced elsewhere (file, pasted JSON or a raw URL / Gist).
export default function LoadDataDialog({ onLoaded, onClose }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const accept = (text, label) => {
    const { records, errors } = parseRecords(text);
    if (!records.length) return setError(errors[0] || t("No places found in this data"));
    onLoaded({ records, source: "custom", label, skipped: errors.length });
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setError(null);
    accept(await f.text(), f.name);
  };
  const onUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await loadFromUrl(url);
      onLoaded({ records: r.records, source: "url", label: r.source, url: url.trim(), skipped: r.errors.length });
    } catch (err) {
      setError(t("Could not load this URL: {error}", { error: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const box = "rounded-2xl border border-stone-200 bg-white p-4";
  const btn =
    "inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-label={t("Load data")}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#fbf7f1] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
          aria-label={t("Close")}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-stone-900">{t("Load data")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("Open the zimmers.json your agent gave you. It stays in this browser only.")}</p>

        <div className="mt-4 space-y-3">
          <div className={box}>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={onFile}
              data-testid="load-file"
            />
            <button type="button" className={btn} onClick={() => fileRef.current && fileRef.current.click()}>
              <FileUp className="h-4 w-4" /> {t("Choose a JSON file")}
            </button>
          </div>

          <div className={box}>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700" htmlFor="zf-paste">
              <ClipboardPaste className="h-4 w-4" /> {t("Or paste the JSON")}
            </label>
            <textarea
              id="zf-paste"
              dir="ltr"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder='[{ "slug": "...", "name": "...", "price_total": 1900 }]'
              className="w-full rounded-xl border border-stone-200 p-2 font-mono text-xs"
            />
            <button type="button" className={`${btn} mt-2`} disabled={!text.trim()} onClick={() => accept(text, t("pasted data"))}>
              {t("Show places")}
            </button>
          </div>

          <form className={box} onSubmit={onUrl}>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700" htmlFor="zf-url">
              <Link2 className="h-4 w-4" /> {t("Or a link (raw GitHub, Gist)")}
            </label>
            <div className="flex gap-2">
              <input
                id="zf-url"
                dir="ltr"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://gist.githubusercontent.com/.../raw"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <button type="submit" className={btn} disabled={busy || !url.trim()}>
                {t("Load")}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
