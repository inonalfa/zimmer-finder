import { ThumbsUp, ThumbsDown } from "lucide-react";
import { t } from "@/i18n";

const names = (arr) => arr.join(", ");

// compact: card version (counts + one-line names). full: detail version (lists all names).
export default function VoteBar({ info, onVote, full = false, myName = "" }) {
  const { likes, unlikes, mine } = info;
  const stop = (e) => e.stopPropagation();
  const click = (v) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    onVote(mine === v ? null : v);
  };
  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold transition-all active:scale-95 select-none";
  const size = full ? "min-h-[44px] px-4 text-base" : "min-h-[38px] px-3 text-sm";
  const likeCls =
    mine === "like"
      ? "border-rose-500 bg-rose-500 text-white shadow-sm"
      : "border-stone-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-rose-50";
  const unlikeCls =
    mine === "unlike"
      ? "border-stone-700 bg-stone-700 text-white shadow-sm"
      : "border-stone-200 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100";

  return (
    <div onClick={stop} className={full ? "flex flex-col gap-3" : "flex flex-col gap-1.5"}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={click("like")}
          aria-pressed={mine === "like"}
          title={mine === "like" ? t("Remove like") : t("Like")}
          className={`${btn} ${size} ${likeCls}`}
        >
          <ThumbsUp className={full ? "h-5 w-5" : "h-4 w-4"} fill={mine === "like" ? "currentColor" : "none"} />
          {t("Like")}
          <span className={`rounded-full px-1.5 text-xs ${mine === "like" ? "bg-white/25" : "bg-stone-100"}`}>{likes.length}</span>
        </button>
        <button
          type="button"
          onClick={click("unlike")}
          aria-pressed={mine === "unlike"}
          title={mine === "unlike" ? t("Remove dislike") : t("Dislike")}
          className={`${btn} ${size} ${unlikeCls}`}
        >
          <ThumbsDown className={full ? "h-5 w-5" : "h-4 w-4"} fill={mine === "unlike" ? "currentColor" : "none"} />
          {t("Dislike")}
          <span className={`rounded-full px-1.5 text-xs ${mine === "unlike" ? "bg-white/25" : "bg-stone-100"}`}>{unlikes.length}</span>
        </button>
      </div>
      {full ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <NameList title={t("Liked")} list={likes} tone="like" me={myName} />
          <NameList title={t("Disliked")} list={unlikes} tone="unlike" me={myName} />
        </div>
      ) : (
        (likes.length > 0 || unlikes.length > 0) && (
          <div className="text-xs leading-snug text-stone-500">
            {likes.length > 0 && (
              <p className="truncate" title={`${t("Liked")}: ${names(likes)}`}>
                <span className="font-semibold text-rose-600">{t("Liked")}:</span> {names(likes)}
              </p>
            )}
            {unlikes.length > 0 && (
              <p className="truncate" title={`${t("Disliked")}: ${names(unlikes)}`}>
                <span className="font-semibold text-stone-700">{t("Disliked")}:</span> {names(unlikes)}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}

function NameList({ title, list, tone, me }) {
  const box = tone === "like" ? "border-rose-100 bg-rose-50/60" : "border-stone-200 bg-stone-50";
  const head = tone === "like" ? "text-rose-700" : "text-stone-700";
  return (
    <div className={`rounded-2xl border p-3 ${box}`}>
      <div className={`mb-1.5 text-sm font-bold ${head}`}>
        {title} ({list.length})
      </div>
      {list.length ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((n) => (
            <span
              key={n}
              className={`rounded-full px-2.5 py-0.5 text-sm shadow-sm ${n === me ? "bg-orange-600 font-semibold text-white" : "bg-white text-stone-800"}`}
            >
              {n}
              {n === me ? ` ${t("(you)")}` : ""}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400">{t("None yet")}</p>
      )}
    </div>
  );
}
